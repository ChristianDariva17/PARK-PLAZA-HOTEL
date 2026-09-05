import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt, gte, inArray, isNull, lt } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import type { AuthenticatedCustomer } from '../customer/customer.types.js';
import type { CustomerAvailabilityQuery, CustomerBookingDto } from '../customer/customer.dto.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { getPostgresErrorFields } from '../database/postgres-error.js';
import { ACTIVE_RESERVATION_STATUSES, guests, identityDocuments, properties, reservationGuests, reservations, roomCategories, rooms } from '../database/schema/index.js';
import { customerGuestIdentities, customerReservationCommands, customerReservations } from '../database/schema/customer.schema.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import { assertInterval, proratedAmount, resolveLocalMinute, type PropertyIntervalPolicy } from './interval-policy.js';

function parseCivilDates(policy: PropertyIntervalPolicy, input: { checkInDate: string; checkOutDate: string }) {
  const checkInTime = policy.dayUseStart || '14:00';
  const checkOutTime = policy.dayUseEnd || '12:00';
  const checkInAt = resolveLocalMinute(`${input.checkInDate}T${checkInTime}`, policy.timezone);
  const checkOutAt = resolveLocalMinute(`${input.checkOutDate}T${checkOutTime}`, policy.timezone);
  const minutes = Math.max((checkOutAt.getTime() - checkInAt.getTime()) / 60_000, 1440);
  return { checkInAt, checkOutAt, minutes, checkInDate: input.checkInDate, checkOutDate: input.checkOutDate };
}
import type { AvailabilityQuery, CreateReservationDto } from './reservations.dto.js';

const reservationSelection = {
  id: reservations.id, roomId: reservations.roomId, primaryGuestId: reservations.primaryGuestId, status: reservations.status,
  checkInAt: reservations.checkInAt, checkOutAt: reservations.checkOutAt, guestCount: reservations.guestCount,
  nightlyRate: reservations.nightlyRate, totalAmount: reservations.totalAmount, createdAt: reservations.createdAt, updatedAt: reservations.updatedAt,
};
const roomSelection = {
  roomId: rooms.id, categoryId: roomCategories.id, categoryCode: roomCategories.code, categoryName: roomCategories.name, number: rooms.number, floor: rooms.floor, operationalStatus: rooms.status,
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
      checkInAt: interval.checkInAt.toISOString(),
      checkOutAt: interval.checkOutAt.toISOString(),
      durationMinutes: interval.minutes,
      guestCount: query.guestCount,
      policy,
      rooms: rows.map((room) => ({
        roomId: room.roomId,
        categoryId: room.categoryId,
        number: room.number,
        floor: room.floor,
        capacity: room.capacity,
        operationalStatus: room.operationalStatus,
        nightlyRate: room.nightlyRate,
        totalAmount: proratedAmount(room.nightlyRate, interval.minutes),
      })),
    };
  }

  async customerAvailability(propertyId: string, query: CustomerAvailabilityQuery) {
    try {
      const policy = await this.propertyPolicy(propertyId);
      const interval = parseCivilDates(policy, query);
      const categories = await this.database.select({
        id: roomCategories.id,
        code: roomCategories.code,
        name: roomCategories.name,
        capacity: roomCategories.capacity,
        nightlyRate: roomCategories.baseNightlyRate,
      }).from(roomCategories).where(and(eq(roomCategories.propertyId, propertyId), gte(roomCategories.capacity, query.guestCount)));

      const resultCategories = [];
      for (const cat of categories) {
        const availableRooms = await this.database.select({ id: rooms.id }).from(rooms).leftJoin(reservations, and(
          eq(reservations.propertyId, propertyId), eq(reservations.roomId, rooms.id), inArray(reservations.status, [...ACTIVE_RESERVATION_STATUSES]),
          lt(reservations.checkInAt, interval.checkOutAt), gt(reservations.checkOutAt, interval.checkInAt),
        )).where(and(eq(rooms.propertyId, propertyId), eq(rooms.categoryId, cat.id), eq(rooms.status, 'available'), isNull(reservations.id)));

        if (availableRooms.length > 0) {
          resultCategories.push({
            code: cat.code,
            name: cat.name,
            categoryCode: cat.code,
            categoryName: cat.name,
            capacity: cat.capacity,
            nightlyRate: cat.nightlyRate,
            totalAmount: proratedAmount(cat.nightlyRate, interval.minutes),
            availableCount: availableRooms.length,
          });
        }
      }

      return {
        checkInDate: interval.checkInDate,
        checkOutDate: interval.checkOutDate,
        durationMinutes: interval.minutes,
        guestCount: query.guestCount,
        currency: 'PEN',
        categories: resultCategories,
      };
    } catch (err) {
      console.error('CUSTOMER AVAILABILITY ERROR:', err);
      throw err;
    }
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

  async createForCustomer(customer: AuthenticatedCustomer, input: CustomerBookingDto, key: string, context: RequestContext) {
    const document = input.guest.primaryDocument;
    const fingerprint = this.fingerprint({ customer: customer.customerAccountId, property: customer.propertyId, ...input });

    return this.database.transaction(async (tx) => {
      const replay = await this.findCustomerReservationReceipt(tx, customer, key, fingerprint);
      if (replay) return replay;

      const policy = await this.propertyPolicy(customer.propertyId, tx);
      const interval = parseCivilDates(policy, input);
      const propertyRows = await tx.select({ currency: properties.currency }).from(properties).where(eq(properties.id, customer.propertyId)).limit(1);
      const currency = propertyRows[0]?.currency ?? 'PEN';

      const docType = document.type.trim() as 'dni' | 'passport' | 'foreign_id' | 'other';
      const docCountry = document.issuingCountry.trim();
      const docNum = document.documentNumber.trim();

      const bindingRows = await tx.select({
        propertyId: customerGuestIdentities.propertyId,
        id: guests.id,
        status: guests.status,
        firstName: guests.firstName,
        lastName: guests.lastName,
        documentType: identityDocuments.type,
        documentCountry: identityDocuments.issuingCountry,
        documentNumber: identityDocuments.documentNumber,
      }).from(customerGuestIdentities)
        .innerJoin(guests, and(eq(guests.id, customerGuestIdentities.guestId), eq(guests.propertyId, customerGuestIdentities.propertyId)))
        .innerJoin(identityDocuments, and(eq(identityDocuments.guestId, guests.id), eq(identityDocuments.propertyId, guests.propertyId), eq(identityDocuments.isPrimary, true)))
        .where(eq(customerGuestIdentities.customerAccountId, customer.customerAccountId)).limit(1);

      const binding = bindingRows[0];
      let primaryGuest: { id: string; status: typeof guests.$inferSelect.status; firstName: string; lastName: string };

      if (binding) {
        await tx.update(identityDocuments).set({
          type: docType,
          issuingCountry: docCountry,
          documentNumber: docNum,
        }).where(and(eq(identityDocuments.guestId, binding.id), eq(identityDocuments.propertyId, customer.propertyId), eq(identityDocuments.isPrimary, true)));

        await tx.update(guests).set({
          firstName: input.guest.firstName,
          lastName: input.guest.lastName,
          email: input.guest.email ?? undefined,
          phone: input.guest.phone ?? undefined,
        }).where(and(eq(guests.id, binding.id), eq(guests.propertyId, customer.propertyId)));

        primaryGuest = { id: binding.id, status: binding.status, firstName: input.guest.firstName, lastName: input.guest.lastName };
      } else {
        const collisionRows = await tx.select({ guestId: identityDocuments.guestId }).from(identityDocuments)
          .where(and(
            eq(identityDocuments.propertyId, customer.propertyId),
            eq(identityDocuments.type, docType),
            eq(identityDocuments.documentNumber, docNum),
          )).limit(1);

        if (collisionRows[0]) {
          const guestId = collisionRows[0].guestId;
          await tx.insert(customerGuestIdentities).values({
            customerAccountId: customer.customerAccountId,
            guestId,
            propertyId: customer.propertyId,
          }).onConflictDoNothing();

          await tx.update(guests).set({
            firstName: input.guest.firstName,
            lastName: input.guest.lastName,
            email: input.guest.email ?? undefined,
            phone: input.guest.phone ?? undefined,
          }).where(and(eq(guests.id, guestId), eq(guests.propertyId, customer.propertyId)));

          primaryGuest = { id: guestId, status: 'active', firstName: input.guest.firstName, lastName: input.guest.lastName };
        } else {
          const guestRows = await tx.insert(guests).values({
            propertyId: customer.propertyId,
            firstName: input.guest.firstName,
            lastName: input.guest.lastName,
            nationality: input.guest.nationality ?? null,
            email: input.guest.email ?? null,
            phone: input.guest.phone ?? null,
            address: input.guest.address ?? null,
            emergencyContact: input.guest.emergencyContact ?? null,
            notes: input.guest.notes ?? null,
          }).returning({ id: guests.id, status: guests.status, firstName: guests.firstName, lastName: guests.lastName });

          primaryGuest = guestRows[0]!;

          await tx.insert(identityDocuments).values({
            guestId: primaryGuest.id,
            propertyId: customer.propertyId,
            type: docType,
            issuingCountry: docCountry,
            documentNumber: docNum,
            isPrimary: true,
          }).onConflictDoNothing();

          await tx.insert(customerGuestIdentities).values({
            customerAccountId: customer.customerAccountId,
            guestId: primaryGuest.id,
            propertyId: customer.propertyId,
          }).onConflictDoNothing();
        }
      }

      const roomRows = await tx.select(roomSelection).from(rooms).innerJoin(roomCategories,
        and(eq(rooms.categoryId, roomCategories.id), eq(rooms.propertyId, roomCategories.propertyId)),
      ).leftJoin(reservations, and(
        eq(reservations.propertyId, customer.propertyId), eq(reservations.roomId, rooms.id), inArray(reservations.status, [...ACTIVE_RESERVATION_STATUSES]),
        lt(reservations.checkInAt, interval.checkOutAt), gt(reservations.checkOutAt, interval.checkInAt),
      )).where(and(eq(rooms.propertyId, customer.propertyId), eq(roomCategories.code, input.categoryCode), eq(rooms.status, 'available'), gte(roomCategories.capacity, input.guestCount), isNull(reservations.id)))
        .orderBy(asc(rooms.floor), asc(rooms.number), asc(rooms.id)).limit(1).for('update', { of: rooms });

      const room = roomRows[0];
      if (!room) throw new ConflictException('No room is available in the selected category');

      const totalAmount = proratedAmount(room.nightlyRate, interval.minutes);
      const insertedRows = await tx.insert(reservations).values({
        propertyId: customer.propertyId, roomId: room.roomId, primaryGuestId: primaryGuest.id, status: 'pending',
        checkIn: interval.checkInDate, checkOut: interval.checkOutDate, checkInAt: interval.checkInAt, checkOutAt: interval.checkOutAt,
        guestCount: input.guestCount, nightlyRate: room.nightlyRate, totalAmount,
      }).returning(reservationSelection);

      const reservation = insertedRows[0]!;
      await tx.insert(reservationGuests).values({ reservationId: reservation.id, guestId: primaryGuest.id, propertyId: customer.propertyId, isPrimary: true });
      await tx.insert(customerReservations).values({ reservationId: reservation.id, propertyId: customer.propertyId, customerAccountId: customer.customerAccountId });

      const response = {
        id: reservation.id,
        status: reservation.status,
        checkInDate: interval.checkInDate,
        checkOutDate: interval.checkOutDate,
        checkInAt: interval.checkInAt.toISOString(),
        checkOutAt: interval.checkOutAt.toISOString(),
        guestCount: input.guestCount,
        categoryCode: room.categoryCode,
        categoryName: room.categoryName,
        primaryGuestName: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
        nightlyRate: room.nightlyRate,
        currency,
        totalAmount: reservation.totalAmount,
        createdAt: reservation.createdAt.toISOString(),
        updatedAt: reservation.updatedAt.toISOString(),
      };

      await tx.insert(customerReservationCommands).values({
        propertyId: customer.propertyId,
        customerAccountId: customer.customerAccountId,
        reservationId: reservation.id,
        idempotencyKey: key,
        fingerprint,
        response: response as any,
      });

      return { reservation: response, replayed: false };
    });
  }

  async customerDetail(customer: AuthenticatedCustomer, reservationId: string) {
    const rows = await this.database.select().from(customerReservations)
      .innerJoin(reservations, and(eq(reservations.id, customerReservations.reservationId), eq(reservations.propertyId, customer.propertyId)))
      .innerJoin(rooms, and(eq(rooms.id, reservations.roomId), eq(rooms.propertyId, customer.propertyId)))
      .innerJoin(roomCategories, and(eq(roomCategories.id, rooms.categoryId), eq(roomCategories.propertyId, customer.propertyId)))
      .where(and(eq(customerReservations.customerAccountId, customer.customerAccountId), eq(customerReservations.reservationId, reservationId)))
      .limit(1);

    const row = rows[0];
    if (!row) throw new NotFoundException('Reservation not found');
    return {
      id: row.reservations.id,
      status: row.reservations.status,
      checkInDate: row.reservations.checkIn,
      checkOutDate: row.reservations.checkOut,
      guestCount: row.reservations.guestCount,
      roomNumber: row.rooms.number,
      categoryName: row.room_categories.name,
      totalAmount: row.reservations.totalAmount,
    };
  }

  private fingerprint(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private async findCustomerReservationReceipt(tx: any, customer: AuthenticatedCustomer, idempotencyKey: string, fingerprint: string) {
    const [receipt] = await tx.select().from(customerReservationCommands)
      .where(and(eq(customerReservationCommands.customerAccountId, customer.customerAccountId), eq(customerReservationCommands.idempotencyKey, idempotencyKey)))
      .limit(1).for('update');
    if (!receipt) return null;
    if (receipt.fingerprint !== fingerprint) throw new ConflictException('Idempotency key conflict');
    return { reservation: receipt.response, replayed: true };
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
