import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { getPostgresErrorFields } from '../database/postgres-error.js';
import { cleaningTasks, folios, guests, identityDocuments, properties, receivables, reservationGuests, reservations, roomCategories, rooms, stayCommands, stayGuests, stays } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import { assertEligibleEarlyCheckIn, assertInterval, proratedAmount, type PropertyIntervalPolicy } from '../reservations/interval-policy.js';
import type { CheckInDto, CheckOutDto, WalkInDto } from './stays.dto.js';
import { FolioService } from '../folios/folio.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

export interface StayCommandResponse extends Record<string, unknown> {
  stay: { id: string; reservationId: string; roomId: string; status: 'active' | 'checked_out'; checkInAt: string; checkOutAt: string | null };
  folio: { id: string; stayId: string; openingBalance: '0.00' };
  reservation: { id: string; status: string; checkInAt: string; checkOutAt: string };
  room: { id: string; status: 'available' | 'occupied' | 'cleaning' };
}
export interface PersistentStayResponse {
  id: string; reservationId: string; roomId: string; status: 'active' | 'checked_out'; checkInAt: string; checkOutAt: string | null;
}

const propertySelection = { timezone: properties.timezone, dayUseStart: properties.dayUseStart, dayUseEnd: properties.dayUseEnd, dayUseMinimumMinutes: properties.dayUseMinimumMinutes, reservationIntervalMinutes: properties.reservationIntervalMinutes };

@Injectable()
export class StaysService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly foliosService: FolioService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(propertyId: string): Promise<PersistentStayResponse[]> {
    const rows = await this.database.select({ id: stays.id, reservationId: stays.reservationId, roomId: stays.roomId, status: stays.status, checkInAt: stays.checkInAt, checkOutAt: stays.checkOutAt })
      .from(stays).where(eq(stays.propertyId, propertyId));
    return rows.map((stay) => ({ id: stay.id, reservationId: stay.reservationId, roomId: stay.roomId, status: stay.status, checkInAt: stay.checkInAt.toISOString(), checkOutAt: stay.checkOutAt?.toISOString() ?? null }));
  }

  checkIn(actor: AuthenticatedAccount, reservationId: string, input: CheckInDto, key: string, context: RequestContext): Promise<StayCommandResponse> {
    return this.command(actor, 'reservation_check_in', key, context, async (tx, policy) => {
      const reservationRows = await tx.select().from(reservations).where(and(eq(reservations.id, reservationId), eq(reservations.propertyId, actor.propertyId))).limit(1).for('update', { of: reservations });
      const reservation = reservationRows[0];
      if (!reservation) throw new NotFoundException('Reservation not found');
      if (!['pending', 'confirmed'].includes(reservation.status)) throw new ConflictException('Reservation is not eligible for check-in');
      const room = await this.lockAvailableRoom(tx, actor.propertyId, reservation.roomId);
      let checkInAt = reservation.checkInAt;
      if (input.earlyCheckInAt) {
        const requestedStart = new Date(input.earlyCheckInAt);
        assertEligibleEarlyCheckIn(policy, reservation.checkInAt, requestedStart);
        const amended = assertInterval(policy, { checkInAt: input.earlyCheckInAt, checkOutAt: reservation.checkOutAt.toISOString() });
        await tx.update(reservations).set({ checkIn: amended.checkInDate, checkInAt: amended.checkInAt, updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
        checkInAt = amended.checkInAt;
        await this.audit.record({ ...this.auditBase(actor, context), eventType: 'reservation.early_check_in_amended', subjectType: 'reservation', subjectId: reservation.id, metadata: { roomId: reservation.roomId, previousCheckInAt: reservation.checkInAt.toISOString(), checkInAt: amended.checkInAt.toISOString(), reason: 'authorized_early_check_in' } }, tx);
      }
      const guestsForStay = await this.assertIdentifiedGuests(tx, actor.propertyId, reservation.id);
      return this.createStay(tx, actor, context, { reservationId: reservation.id, room, guestsForStay, checkInAt, checkOutAt: reservation.checkOutAt, reservationStatus: 'checked_in' });
    });
  }

  walkIn(actor: AuthenticatedAccount, input: WalkInDto, key: string, context: RequestContext): Promise<StayCommandResponse> {
    return this.command(actor, 'walk_in', key, context, async (tx, policy) => {
      const interval = assertInterval(policy, input);
      const room = await this.lockAvailableRoom(tx, actor.propertyId, input.roomId);
      if (input.guestCount > room.capacity) throw new BadRequestException('Guest count exceeds room capacity');
      await this.assertGuestIds(tx, actor.propertyId, input.guestIds);
      const totalAmount = proratedAmount(room.nightlyRate, interval.minutes);
      const inserted = await tx.insert(reservations).values({
        propertyId: actor.propertyId, roomId: room.id, primaryGuestId: input.primaryGuestId, status: 'checked_in', checkIn: interval.checkInDate, checkOut: interval.checkOutDate,
        checkInAt: interval.checkInAt, checkOutAt: interval.checkOutAt, guestCount: input.guestCount, nightlyRate: room.nightlyRate, totalAmount,
      }).returning({ id: reservations.id });
      const reservation = inserted[0];
      if (!reservation) throw new Error('Walk-in reservation insert did not return a row');
      await tx.insert(reservationGuests).values(input.guestIds.map((guestId) => ({ reservationId: reservation.id, guestId, propertyId: actor.propertyId, isPrimary: guestId === input.primaryGuestId })));
      return this.createStay(tx, actor, context, { reservationId: reservation.id, room, guestsForStay: input.guestIds.map((id) => ({ id, isPrimary: id === input.primaryGuestId })), checkInAt: interval.checkInAt, checkOutAt: interval.checkOutAt, reservationStatus: 'checked_in', walkIn: true });
    });
  }

  checkOut(actor: AuthenticatedAccount, stayId: string, input: CheckOutDto, key: string, context: RequestContext): Promise<StayCommandResponse> {
    return this.command(actor, 'check_out', key, context, async (tx) => {
      const rows = await tx.select().from(stays).where(and(eq(stays.id, stayId), eq(stays.propertyId, actor.propertyId))).limit(1).for('update', { of: stays });
      const stay = rows[0];
      if (!stay) throw new NotFoundException('Stay not found');
      if (stay.status !== 'active') throw new ConflictException('Stay is already checked out');
      const folioState = await this.foliosService.read(tx, actor.propertyId, stayId, true);
      const hasDebt = BigInt(folioState.balance.replace('.', '')) > 0n;
      if (hasDebt && (!actor.permissions.includes('stays.check_out') || !actor.permissions.includes('stays.check_out_override') || !input.overrideReason?.trim())) throw new ConflictException('Outstanding folio balance requires an authorized receivable override');
      const roomRows = await tx.select({ id: rooms.id, status: rooms.status }).from(rooms).where(and(eq(rooms.id, stay.roomId), eq(rooms.propertyId, actor.propertyId))).limit(1).for('update', { of: rooms });
      const room = roomRows[0];
      if (!room || room.status !== 'occupied') throw new ConflictException('Room state does not permit check-out');
      const reservationRows = await tx.select({ id: reservations.id, primaryGuestId: reservations.primaryGuestId, checkInAt: reservations.checkInAt, checkOutAt: reservations.checkOutAt }).from(reservations).where(and(eq(reservations.id, stay.reservationId), eq(reservations.propertyId, actor.propertyId))).limit(1);
      const reservation = reservationRows[0];
      if (!reservation) throw new ConflictException('Stay reservation is unavailable');
      const now = new Date();
      await tx.update(stays).set({ status: 'checked_out', settlement: hasDebt ? 'receivable' : 'settled', ...(hasDebt ? { receivableAmount: folioState.balance, receivableReason: input.overrideReason } : {}), checkOutAt: now, updatedAt: now }).where(eq(stays.id, stay.id));
      await tx.update(reservations).set({ status: 'completed', updatedAt: now }).where(eq(reservations.id, reservation.id));
      await tx.update(rooms).set({ status: 'cleaning' }).where(eq(rooms.id, room.id));
      await tx.insert(cleaningTasks).values({
        propertyId: actor.propertyId,
        roomId: room.id,
        stayId: stay.id,
        status: 'pending',
        assignedTo: 'Por asignar',
        reason: 'Check-out completado',
        evidence: [],
      });
      const folio = await this.findFolio(tx, stay.id, actor.propertyId);
      if (hasDebt) {
        const primaryGuestId = reservation.primaryGuestId;
        if (!primaryGuestId) throw new ConflictException('Stay reservation guest is unavailable');
        await tx.insert(receivables).values({ propertyId: actor.propertyId, stayId: stay.id, reservationId: stay.reservationId, primaryGuestId, folioId: folio.id, status: 'open', originalAmount: folioState.balance, outstandingAmount: folioState.balance, reason: input.overrideReason!.trim(), openedAt: now }).onConflictDoUpdate({ target: receivables.stayId, set: { outstandingAmount: folioState.balance, updatedAt: now } });
      }
      const response: StayCommandResponse = {
        stay: { id: stay.id, reservationId: stay.reservationId, roomId: stay.roomId, status: 'checked_out', checkInAt: stay.checkInAt.toISOString(), checkOutAt: now.toISOString() },
        folio, reservation: { id: reservation.id, status: 'completed', checkInAt: reservation.checkInAt.toISOString(), checkOutAt: reservation.checkOutAt.toISOString() }, room: { id: room.id, status: 'cleaning' },
      };
      await this.audit.record({ ...this.auditBase(actor, context), eventType: hasDebt ? 'stay.checked_out_receivable' : 'stay.checked_out', subjectType: 'stay', subjectId: stay.id, metadata: { reservationId: stay.reservationId, roomId: room.id, status: 'checked_out', roomStatus: 'cleaning', balance: folioState.balance, overrideReason: input.overrideReason ?? null } }, tx);
      return response;
    });
  }

  cleaningComplete(actor: AuthenticatedAccount, roomId: string, key: string, context: RequestContext): Promise<StayCommandResponse> {
    return this.command(actor, 'cleaning_complete', key, context, async (tx) => {
      const rows = await tx.select({ id: rooms.id, status: rooms.status }).from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.propertyId, actor.propertyId))).limit(1).for('update', { of: rooms });
      const room = rows[0];
      if (!room) throw new NotFoundException('Room not found');
      if (room.status !== 'cleaning') throw new ConflictException('Room is not awaiting cleaning completion');
      const stayRows = await tx.select({ id: stays.id, reservationId: stays.reservationId, checkInAt: stays.checkInAt, checkOutAt: stays.checkOutAt }).from(stays)
        .where(and(eq(stays.roomId, room.id), eq(stays.propertyId, actor.propertyId), eq(stays.status, 'checked_out'))).orderBy(desc(stays.checkOutAt)).limit(1);
      const latestStay = stayRows[0];
      if (!latestStay?.checkOutAt) throw new ConflictException('No checked-out stay is available for this room');
      const taskRows = await tx.select({ id: cleaningTasks.id, status: cleaningTasks.status }).from(cleaningTasks)
        .where(and(eq(cleaningTasks.propertyId, actor.propertyId), eq(cleaningTasks.roomId, room.id), eq(cleaningTasks.stayId, latestStay.id)))
        .limit(1).for('update', { of: cleaningTasks });
      const task = taskRows[0];
      if (!task || task.status === 'approved') throw new ConflictException('The checked-out stay has no pending cleaning task');
      const reservationRows = await tx.select({ id: reservations.id, status: reservations.status, checkInAt: reservations.checkInAt, checkOutAt: reservations.checkOutAt }).from(reservations)
        .where(and(eq(reservations.id, latestStay.reservationId), eq(reservations.propertyId, actor.propertyId))).limit(1);
      const reservation = reservationRows[0];
      if (!reservation || reservation.status !== 'completed') throw new ConflictException('Room checkout state is invalid');
      const folio = await this.findFolio(tx, latestStay.id, actor.propertyId);
      await tx.update(rooms).set({ status: 'available' }).where(eq(rooms.id, room.id));
      await tx.update(cleaningTasks).set({ status: 'approved', completedAt: new Date(), updatedAt: new Date() }).where(eq(cleaningTasks.id, task.id));
      const response: StayCommandResponse = { stay: { id: latestStay.id, reservationId: latestStay.reservationId, roomId: room.id, status: 'checked_out', checkInAt: latestStay.checkInAt.toISOString(), checkOutAt: latestStay.checkOutAt.toISOString() }, folio, reservation: { id: reservation.id, status: reservation.status, checkInAt: reservation.checkInAt.toISOString(), checkOutAt: reservation.checkOutAt.toISOString() }, room: { id: room.id, status: 'available' } };
      await this.audit.record({ ...this.auditBase(actor, context), eventType: 'room.cleaning_completed', subjectType: 'room', subjectId: room.id, metadata: { roomId: room.id, status: 'available' } }, tx);
      return response;
    });
  }


  private async command(actor: AuthenticatedAccount, operation: string, key: string, context: RequestContext, run: (tx: any, policy: PropertyIntervalPolicy) => Promise<StayCommandResponse>): Promise<StayCommandResponse> {
    try {
      return await this.database.transaction(async (tx) => {
        await acquirePropertyTransactionLock(tx, actor.propertyId);
        const receiptRows = await tx.select({ response: stayCommands.response }).from(stayCommands).where(and(eq(stayCommands.propertyId, actor.propertyId), eq(stayCommands.operation, operation), eq(stayCommands.idempotencyKey, key))).limit(1);
        if (receiptRows[0]) return receiptRows[0].response as StayCommandResponse;
        const policyRows = await tx.select(propertySelection).from(properties).where(eq(properties.id, actor.propertyId)).limit(1);
        const policy = policyRows[0];
        if (!policy) throw new NotFoundException('Property not found');
        const response = await run(tx, policy);
        await tx.insert(stayCommands).values({ propertyId: actor.propertyId, operation, idempotencyKey: key, response });
        this.realtime.emitToProperty(actor.propertyId, 'room:status_changed', response.room);
        this.realtime.emitToProperty(actor.propertyId, 'stay:status_changed', response);
        return response;
      });
    } catch (error) {
      const postgres = getPostgresErrorFields(error);
      if (postgres?.code === '23P01' || (postgres?.code === '23505' && ['stays_one_active_per_reservation_idx', 'stays_one_active_per_room_idx'].includes(postgres.constraint || ''))) throw new ConflictException('The room or reservation was changed by another operation');
      throw error;
    }
  }

  private async lockAvailableRoom(tx: any, propertyId: string, roomId: string) {
    const rows = await tx.select({ id: rooms.id, status: rooms.status, capacity: roomCategories.capacity, nightlyRate: roomCategories.baseNightlyRate }).from(rooms).innerJoin(roomCategories, and(eq(rooms.categoryId, roomCategories.id), eq(rooms.propertyId, roomCategories.propertyId)))
      .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, propertyId))).limit(1).for('update', { of: rooms });
    const room = rows[0];
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== 'available') throw new ConflictException('Room is not available');
    return room;
  }

  private async assertIdentifiedGuests(tx: any, propertyId: string, reservationId: string): Promise<Array<{ id: string; isPrimary: boolean }>> {
    const linked = await tx.select({ id: reservationGuests.guestId, isPrimary: reservationGuests.isPrimary }).from(reservationGuests).where(and(eq(reservationGuests.reservationId, reservationId), eq(reservationGuests.propertyId, propertyId)));
    if (!linked.length || linked.filter((guest: { isPrimary: boolean }) => guest.isPrimary).length !== 1) throw new ConflictException('Reservation guests are incomplete');
    await this.assertGuestIds(tx, propertyId, linked.map((guest: { id: string }) => guest.id));
    return linked;
  }

  private async assertGuestIds(tx: any, propertyId: string, guestIds: string[]): Promise<void> {
    const current = await tx.select({ id: guests.id, status: guests.status }).from(guests).where(and(eq(guests.propertyId, propertyId), inArray(guests.id, guestIds)));
    const documents = await tx.select({ guestId: identityDocuments.guestId }).from(identityDocuments).where(and(eq(identityDocuments.propertyId, propertyId), inArray(identityDocuments.guestId, guestIds)));
    if (current.length !== guestIds.length || current.some((guest: { status: string }) => guest.status !== 'active') || new Set(documents.map((document: { guestId: string }) => document.guestId)).size !== guestIds.length) throw new ConflictException('Every stay guest must be active and identified');
  }

  private async createStay(tx: any, actor: AuthenticatedAccount, context: RequestContext, input: { reservationId: string; room: { id: string }; guestsForStay: Array<{ id: string; isPrimary: boolean }>; checkInAt: Date; checkOutAt: Date; reservationStatus: 'checked_in'; walkIn?: boolean }): Promise<StayCommandResponse> {
    const inserted = await tx.insert(stays).values({ propertyId: actor.propertyId, reservationId: input.reservationId, roomId: input.room.id, status: 'active', checkInAt: input.checkInAt }).returning({ id: stays.id });
    const stay = inserted[0];
    if (!stay) throw new Error('Stay insert did not return a row');
    await tx.insert(stayGuests).values(input.guestsForStay.map((guest) => ({ stayId: stay.id, guestId: guest.id, propertyId: actor.propertyId, isPrimary: guest.isPrimary })));
    const folioRows = await tx.insert(folios).values({ propertyId: actor.propertyId, stayId: stay.id, openingBalance: '0.00' }).returning({ id: folios.id, stayId: folios.stayId, openingBalance: folios.openingBalance });
    const folio = folioRows[0];
    if (!folio) throw new Error('Folio insert did not return a row');
    await tx.update(rooms).set({ status: 'occupied' }).where(eq(rooms.id, input.room.id));
    await tx.update(reservations).set({ status: input.reservationStatus, updatedAt: new Date() }).where(eq(reservations.id, input.reservationId));
    const response: StayCommandResponse = { stay: { id: stay.id, reservationId: input.reservationId, roomId: input.room.id, status: 'active', checkInAt: input.checkInAt.toISOString(), checkOutAt: null }, folio: { id: folio.id, stayId: folio.stayId, openingBalance: '0.00' }, reservation: { id: input.reservationId, status: input.reservationStatus, checkInAt: input.checkInAt.toISOString(), checkOutAt: input.checkOutAt.toISOString() }, room: { id: input.room.id, status: 'occupied' } };
    await this.audit.record({ ...this.auditBase(actor, context), eventType: input.walkIn ? 'stay.walk_in_checked_in' : 'stay.checked_in', subjectType: 'stay', subjectId: stay.id, metadata: { reservationId: input.reservationId, roomId: input.room.id, status: 'active', checkInAt: input.checkInAt.toISOString(), checkOutAt: input.checkOutAt.toISOString(), folioId: folio.id } }, tx);
    return response;
  }

  private async findFolio(tx: any, stayId: string, propertyId: string): Promise<StayCommandResponse['folio']> {
    const rows = await tx.select({ id: folios.id, stayId: folios.stayId, openingBalance: folios.openingBalance }).from(folios).where(and(eq(folios.stayId, stayId), eq(folios.propertyId, propertyId))).limit(1);
    const folio = rows[0];
    if (!folio || folio.openingBalance !== '0.00') throw new ConflictException('Stay folio is invalid');
    return { id: folio.id, stayId: folio.stayId, openingBalance: '0.00' };
  }

  private auditBase(actor: AuthenticatedAccount, context: RequestContext) { return { actorAccountId: actor.accountId, propertyId: actor.propertyId, ...(context.requestId ? { requestId: context.requestId } : {}), ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}), ...(context.userAgent ? { userAgent: context.userAgent } : {}) }; }
}
