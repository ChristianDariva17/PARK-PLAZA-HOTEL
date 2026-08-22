import { ConflictException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import { ReservationsService } from '../src/reservations/reservations.service.js';

const actor = {
  accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist', email: 'reception@example.invalid',
  permissions: ['reservations.create'], sessionId: 'session-id', passwordChangeRequired: false,
} satisfies AuthenticatedAccount;
const policy = { timezone: 'America/Lima', dayUseStart: '09:00', dayUseEnd: '18:00', dayUseMinimumMinutes: 180, reservationIntervalMinutes: 30 };
const input = {
  roomId: 'room-id', primaryGuestId: 'guest-id', checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z', guestCount: 1,
};
const createdAt = new Date('2028-01-01T00:00:00.000Z');
const reservation = {
  id: 'reservation-id', roomId: input.roomId, primaryGuestId: input.primaryGuestId, status: 'pending' as const,
  checkInAt: new Date(input.checkInAt), checkOutAt: new Date(input.checkOutAt), guestCount: input.guestCount,
  nightlyRate: '100.00', totalAmount: '183.33', createdAt, updatedAt: createdAt,
};

function queryResult<T>(value: T) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (result: T) => unknown, reject?: (error: unknown) => unknown) => Promise<unknown>)> = {};
  for (const method of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(value).then(resolve, reject);
  return query;
}

function reservationService(selections: unknown[][], insertReturns: unknown[] = []) {
  const insertedValues: unknown[] = [];
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => queryResult(selections.shift() ?? [])),
    insert: vi.fn(() => {
      const returningValue = insertReturns.shift();
      return {
        values: vi.fn((values: unknown) => {
          insertedValues.push(values);
          return returningValue === undefined ? Promise.resolve() : { returning: vi.fn().mockResolvedValue(returningValue) };
        }),
      };
    }),
  };
  const database = { transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as unknown as Database;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return { service: new ReservationsService(database, audit as unknown as AuditService), tx, audit, insertedValues };
}

describe('ReservationsService lifecycle boundaries', () => {
  it('returns availability only for rooms scoped to the property, available, and free of active overlap', async () => {
    const propertyQuery = queryResult([policy]);
    const roomsQuery = queryResult([{ roomId: input.roomId, categoryId: 'category-id', number: '101', floor: 1, operationalStatus: 'available' as const, capacity: 1, nightlyRate: '100.00' }]);
    const database = { select: vi.fn().mockReturnValueOnce(propertyQuery).mockReturnValueOnce(roomsQuery) } as unknown as Database;

    const result = await new ReservationsService(database, {} as AuditService).availability(actor.propertyId, input);

    const where = vi.mocked(roomsQuery.where as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const parameters = new PgDialect().sqlToQuery(where).params;
    expect(parameters).toContain(actor.propertyId);
    expect(parameters).toContain('available');
    expect(result).toMatchObject({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, rooms: [{ roomId: input.roomId, totalAmount: '183.33' }] });
  });

  it('creates a property-scoped reservation with the current catalog rate snapshot and a transaction-bound audit event', async () => {
    const setup = reservationService([[policy], [{ roomId: input.roomId, operationalStatus: 'available', capacity: 1, nightlyRate: '100.00' }], [{ id: input.primaryGuestId, status: 'active' }], []], [[reservation], undefined]);

    const result = await setup.service.create(actor, input, { requestId: 'request-id' });

    expect(setup.insertedValues[0]).toEqual(expect.objectContaining({
      propertyId: actor.propertyId, roomId: input.roomId, primaryGuestId: input.primaryGuestId,
      nightlyRate: '100.00', totalAmount: '183.33', status: 'pending',
    }));
    expect(setup.insertedValues[1]).toEqual({ reservationId: reservation.id, guestId: input.primaryGuestId, propertyId: actor.propertyId, isPrimary: true });
    expect(setup.tx.execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({ id: reservation.id, nightlyRate: '100.00', totalAmount: '183.33' }));
    expect(setup.audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'reservation.created', propertyId: actor.propertyId }), setup.tx);
  });

  it('rejects a non-available room without reserving, linking a guest, or auditing', async () => {
    const setup = reservationService([[policy], [{ roomId: input.roomId, operationalStatus: 'cleaning', capacity: 1, nightlyRate: '100.00' }]]);

    await expect(setup.service.create(actor, input, {})).rejects.toBeInstanceOf(ConflictException);

    expect(setup.tx.insert).not.toHaveBeenCalled();
    expect(setup.audit.record).not.toHaveBeenCalled();
  });

  it('maps the database overlap guard to an explicit concurrent-claim conflict', async () => {
    const database = {
      transaction: vi.fn().mockRejectedValue({ code: '23P01', constraint: 'reservations_no_active_overlap' }),
    } as unknown as Database;
    const service = new ReservationsService(database, {} as AuditService);

    await expect(service.create(actor, input, {})).rejects.toBeInstanceOf(ConflictException);
  });
});
