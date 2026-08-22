import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt, gte, inArray, isNull, lt } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { getPostgresErrorFields } from '../database/postgres-error.js';
import { ACTIVE_RESERVATION_STATUSES, guests, properties, reservationGuests, reservations, roomCategories, rooms } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import { assertInterval, proratedAmount, type PropertyIntervalPolicy } from './interval-policy.js';
import type { AvailabilityQuery, CreateReservationDto } from './reservations.dto.js';

const reservationSelection = {
  id: reservations.id, roomId: reservations.roomId, primaryGuestId: reservations.primaryGuestId, status: reservations.status,
  checkInAt: reservations.checkInAt, checkOutAt: reservations.checkOutAt, guestCount: reservations.guestCount,
  nightlyRate: reservations.nightlyRate, totalAmount: reservations.totalAmount, createdAt: reservations.createdAt, updatedAt: reservations.updatedAt,
};
const roomSelection = {
  roomId: rooms.id, categoryId: roomCategories.id, number: rooms.number, floor: rooms.floor, operationalStatus: rooms.status,
  capacity: roomCategories.capacity, nightlyRate: roomCategories.baseNightlyRate,
};
const propertyPolicySelection = {
  timezone: properties.timezone, dayUseStart: properties.dayUseStart, dayUseEnd: properties.dayUseEnd,
  dayUseMinimumMinutes: properties.dayUseMinimumMinutes, reservationIntervalMinutes: properties.reservationIntervalMinutes,
};

type ReservationStatus = typeof reservations.$inferSelect.status;
type RoomStatus = typeof rooms.$inferSelect.status;
type ReservationRow = { id: string; roomId: string; primaryGuestId: string; status: ReservationStatus; checkInAt: Date; checkOutAt: Date; guestCount: number; nightlyRate: string; totalAmount: string; createdAt: Date; updatedAt: Date };

export interface ReservationResponse {
  id: string; roomId: string; primaryGuestId: string; status: ReservationStatus; checkInAt: string; checkOutAt: string;
  guestCount: number; nightlyRate: string; totalAmount: string; createdAt: string; updatedAt: string;
}

export interface AvailabilityResponse {
  checkInAt: string; checkOutAt: string; durationMinutes: number; guestCount: number;
  policy: { timezone: string; dayUseStart: string; dayUseEnd: string; dayUseMinimumMinutes: number; reservationIntervalMinutes: number };
  rooms: Array<{ roomId: string; categoryId: string; number: string; floor: number; capacity: number; operationalStatus: RoomStatus; nightlyRate: string; totalAmount: string }>;
}

@Injectable()
export class ReservationsService {
  constructor(@Inject(DATABASE) private readonly database: Database, private readonly audit: AuditService) {}

  async list(propertyId: string): Promise<ReservationResponse[]> {
    const rows = await this.database.select(reservationSelection).from(reservations).where(eq(reservations.propertyId, propertyId))
      .orderBy(asc(reservations.checkInAt), asc(reservations.checkOutAt), asc(reservations.roomId), asc(reservations.id));
    return rows.map((row) => this.toReservationResponse(row));
  }

  async availability(propertyId: string, query: AvailabilityQuery): Promise<AvailabilityResponse> {
    const policy = await this.propertyPolicy(propertyId);
    const interval = assertInterval(policy, query);
    const rows = await this.database.select(roomSelection).from(rooms).innerJoin(roomCategories,
      and(eq(rooms.categoryId, roomCategories.id), eq(rooms.propertyId, roomCategories.propertyId)),
    ).leftJoin(reservations, and(
      eq(reservations.propertyId, propertyId), eq(reservations.roomId, rooms.id), inArray(reservations.status, [...ACTIVE_RESERVATION_STATUSES]),
      lt(reservations.checkInAt, interval.checkOutAt), gt(reservations.checkOutAt, interval.checkInAt),
    )).where(and(eq(rooms.propertyId, propertyId), eq(rooms.status, 'available'), gte(roomCategories.capacity, query.guestCount), isNull(reservations.id)))
      .orderBy(asc(rooms.floor), asc(rooms.number), asc(rooms.id));
    return {
      checkInAt: interval.checkInAt.toISOString(), checkOutAt: interval.checkOutAt.toISOString(), durationMinutes: interval.minutes, guestCount: query.guestCount,
      policy, rooms: rows.map((room) => ({ ...room, totalAmount: proratedAmount(room.nightlyRate, interval.minutes) })),
    };
  }

  async create(actor: AuthenticatedAccount, input: CreateReservationDto, context: RequestContext): Promise<ReservationResponse> {
    try {
      return await this.database.transaction(async (tx) => {
        await acquirePropertyTransactionLock(tx, actor.propertyId);
        const policy = await this.propertyPolicy(actor.propertyId, tx);
        const interval = assertInterval(policy, input);
        const roomRows = await tx.select(roomSelection).from(rooms).innerJoin(roomCategories,
          and(eq(rooms.categoryId, roomCategories.id), eq(rooms.propertyId, roomCategories.propertyId)),
        ).where(and(eq(rooms.id, input.roomId), eq(rooms.propertyId, actor.propertyId))).limit(1).for('update', { of: rooms });
        const room = roomRows[0];
        if (!room) throw new NotFoundException('Room not found');
        if (room.operationalStatus !== 'available') throw new ConflictException('Room is not available');
        if (input.guestCount > room.capacity) throw new BadRequestException('Guest count exceeds room capacity');

        const guestRows = await tx.select({ id: guests.id, status: guests.status }).from(guests)
          .where(and(eq(guests.id, input.primaryGuestId), eq(guests.propertyId, actor.propertyId))).limit(1);
        const guest = guestRows[0];
        if (!guest) throw new NotFoundException('Guest not found');
        if (guest.status !== 'active') throw new BadRequestException('Archived guest cannot hold a reservation');

        const overlapRows = await tx.select({ id: reservations.id }).from(reservations).where(and(
          eq(reservations.propertyId, actor.propertyId), eq(reservations.roomId, input.roomId), inArray(reservations.status, [...ACTIVE_RESERVATION_STATUSES]),
          lt(reservations.checkInAt, interval.checkOutAt), gt(reservations.checkOutAt, interval.checkInAt),
        )).limit(1);
        if (overlapRows[0]) throw new ConflictException('Room is not available for the selected interval');

        const totalAmount = proratedAmount(room.nightlyRate, interval.minutes);
        const insertedRows = await tx.insert(reservations).values({
          propertyId: actor.propertyId, roomId: input.roomId, primaryGuestId: input.primaryGuestId, status: 'pending',
          checkIn: interval.checkInDate, checkOut: interval.checkOutDate, checkInAt: interval.checkInAt, checkOutAt: interval.checkOutAt,
          guestCount: input.guestCount, nightlyRate: room.nightlyRate, totalAmount,
        }).returning(reservationSelection);
        const reservation = insertedRows[0];
        if (!reservation) throw new Error('Reservation insert did not return a row');
        await tx.insert(reservationGuests).values({ reservationId: reservation.id, guestId: input.primaryGuestId, propertyId: actor.propertyId, isPrimary: true });
        await this.audit.record({
          ...this.auditBase(actor, context), eventType: 'reservation.created', subjectType: 'reservation', subjectId: reservation.id,
          metadata: { roomId: input.roomId, checkInAt: interval.checkInAt.toISOString(), checkOutAt: interval.checkOutAt.toISOString(), guestCount: input.guestCount, durationMinutes: interval.minutes, status: 'pending' },
        }, tx);
        return this.toReservationResponse(reservation);
      });
    } catch (error) {
      const postgresError = getPostgresErrorFields(error);
      if (postgresError?.code === '23P01' && postgresError.constraint === 'reservations_no_active_overlap') throw new ConflictException('Room is not available for the selected interval');
      throw error;
    }
  }

  private async propertyPolicy(propertyId: string, executor: Pick<Database, 'select'> = this.database): Promise<PropertyIntervalPolicy> {
    const rows = await executor.select(propertyPolicySelection).from(properties).where(eq(properties.id, propertyId)).limit(1);
    const policy = rows[0];
    if (!policy) throw new NotFoundException('Property not found');
    return policy;
  }

  private toReservationResponse(row: ReservationRow): ReservationResponse {
    return { id: row.id, roomId: row.roomId, primaryGuestId: row.primaryGuestId, status: row.status, checkInAt: row.checkInAt.toISOString(), checkOutAt: row.checkOutAt.toISOString(), guestCount: row.guestCount, nightlyRate: row.nightlyRate, totalAmount: row.totalAmount, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  private auditBase(actor: AuthenticatedAccount, context: RequestContext) {
    return { actorAccountId: actor.accountId, propertyId: actor.propertyId, ...(context.requestId ? { requestId: context.requestId } : {}), ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}), ...(context.userAgent ? { userAgent: context.userAgent } : {}) };
  }
}
