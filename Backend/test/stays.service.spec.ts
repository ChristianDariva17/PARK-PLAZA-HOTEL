import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import { StaysService, type StayCommandResponse } from '../src/stays/stays.service.js';

const actor = {
  accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist', email: 'reception@example.invalid',
  permissions: ['stays.read', 'stays.check_in', 'stays.check_out', 'cleaning.progress'], sessionId: 'session-id', passwordChangeRequired: false,
} satisfies AuthenticatedAccount;
const context: RequestContext = { requestId: 'request-id' };
const checkInAt = new Date('2028-02-28T15:00:00.000Z');
const checkOutAt = new Date('2028-03-01T11:00:00.000Z');
const policy = { timezone: 'America/Lima', dayUseStart: '09:00', dayUseEnd: '18:00', dayUseMinimumMinutes: 180, reservationIntervalMinutes: 30 };
const reservation = { id: 'reservation-id', roomId: 'room-id', status: 'confirmed' as const, checkInAt, checkOutAt };
const availableRoom = { id: 'room-id', status: 'available' as const, capacity: 2, nightlyRate: '100.00' };
const identifiedGuest = { id: 'guest-id', status: 'active' as const };
const folio = { id: 'folio-id', stayId: 'stay-id', openingBalance: '0.00' };

function queryResult<T>(value: T) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (result: T) => unknown, reject?: (error: unknown) => unknown) => Promise<unknown>)> = {};
  for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(value).then(resolve, reject);
  return query;
}

function lifecycleService(selections: unknown[][], insertReturns: unknown[] = []) {
  const insertedValues: unknown[] = [];
  const updateValues: unknown[] = [];
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
    update: vi.fn(() => {
      const update = {
        set: vi.fn((values: unknown) => {
          updateValues.push(values);
          return update;
        }),
        where: vi.fn(() => update),
      };
      return update;
    }),
  };
  const database = { transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as unknown as Database;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return { service: new StaysService(database, audit as unknown as AuditService), tx, audit, insertedValues, updateValues };
}

describe('StaysService lifecycle', () => {
  it('checks in an eligible reservation with one active stay, a minimal folio, and an audit event', async () => {
    const setup = lifecycleService(
      [[], [policy], [reservation], [availableRoom], [{ id: identifiedGuest.id, isPrimary: true }], [identifiedGuest], [{ guestId: identifiedGuest.id }]],
      [[{ id: 'stay-id' }], undefined, [folio], undefined],
    );

    const result = await setup.service.checkIn(actor, reservation.id, {}, 'key', context);

    expect(result).toEqual({
      stay: { id: 'stay-id', reservationId: reservation.id, roomId: availableRoom.id, status: 'active', checkInAt: checkInAt.toISOString(), checkOutAt: null },
      folio: { ...folio, openingBalance: '0.00' },
      reservation: { id: reservation.id, status: 'checked_in', checkInAt: checkInAt.toISOString(), checkOutAt: checkOutAt.toISOString() },
      room: { id: availableRoom.id, status: 'occupied' },
    });
    expect(setup.insertedValues[2]).toEqual({ propertyId: actor.propertyId, stayId: 'stay-id', openingBalance: '0.00' });
    expect(setup.tx.execute).toHaveBeenCalledTimes(1);
    expect(setup.updateValues).toEqual(expect.arrayContaining([{ status: 'occupied' }, expect.objectContaining({ status: 'checked_in' })]));
    expect(setup.audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'stay.checked_in', subjectId: 'stay-id' }), setup.tx);
  });

  it('rejects a check-in into a cleaning room without creating lifecycle records', async () => {
    const setup = lifecycleService([[], [policy], [reservation], [{ ...availableRoom, status: 'cleaning' }]]);

    await expect(setup.service.checkIn(actor, reservation.id, {}, 'key', context)).rejects.toBeInstanceOf(ConflictException);

    expect(setup.tx.insert).not.toHaveBeenCalled();
    expect(setup.tx.update).not.toHaveBeenCalled();
    expect(setup.audit.record).not.toHaveBeenCalled();
  });

  it('denies an out-of-property reservation before mutating either property', async () => {
    const setup = lifecycleService([[], [policy], []]);

    await expect(setup.service.checkIn(actor, 'foreign-reservation-id', {}, 'key', context)).rejects.toBeInstanceOf(NotFoundException);

    expect(setup.tx.insert).not.toHaveBeenCalled();
    expect(setup.tx.update).not.toHaveBeenCalled();
    expect(setup.audit.record).not.toHaveBeenCalled();
  });

  it('maps a competing active-stay uniqueness failure to a conflict', async () => {
    const database = {
      transaction: vi.fn().mockRejectedValue({ code: '23505', constraint: 'stays_one_active_per_reservation_idx' }),
    } as unknown as Database;
    const service = new StaysService(database, { record: vi.fn() } as unknown as AuditService);

    await expect(service.checkIn(actor, reservation.id, {}, 'key', context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the original walk-in response for a same-key retry without replaying mutations', async () => {
    const original: StayCommandResponse = {
      stay: { id: 'stay-id', reservationId: reservation.id, roomId: availableRoom.id, status: 'active', checkInAt: checkInAt.toISOString(), checkOutAt: null },
      folio: { ...folio, openingBalance: '0.00' },
      reservation: { id: reservation.id, status: 'checked_in', checkInAt: checkInAt.toISOString(), checkOutAt: checkOutAt.toISOString() },
      room: { id: availableRoom.id, status: 'occupied' },
    };
    const setup = lifecycleService([[{ response: original }]]);

    await expect(setup.service.walkIn(actor, {
      roomId: availableRoom.id, primaryGuestId: identifiedGuest.id, guestIds: [identifiedGuest.id],
      checkInAt: checkInAt.toISOString(), checkOutAt: checkOutAt.toISOString(), guestCount: 1,
    }, 'same-key', context)).resolves.toEqual(original);

    expect(setup.tx.select).toHaveBeenCalledTimes(1);
    expect(setup.tx.execute).toHaveBeenCalledTimes(1);
    expect(setup.tx.insert).not.toHaveBeenCalled();
    expect(setup.tx.update).not.toHaveBeenCalled();
    expect(setup.audit.record).not.toHaveBeenCalled();
  });

  it('checks out atomically by closing the stay, completing its reservation, and sending the room to cleaning', async () => {
    const activeStay = { id: 'stay-id', reservationId: reservation.id, roomId: availableRoom.id, status: 'active' as const, checkInAt };
    const setup = lifecycleService([[], [policy], [activeStay], [{ id: availableRoom.id, status: 'occupied' }], [{ id: reservation.id, checkInAt, checkOutAt }], [folio]], [undefined]);

    const result = await setup.service.checkOut(actor, activeStay.id, 'key', context);

    expect(result.stay.status).toBe('checked_out');
    expect(result.reservation.status).toBe('completed');
    expect(result.room).toEqual({ id: availableRoom.id, status: 'cleaning' });
    expect(setup.updateValues).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'checked_out', checkOutAt: expect.any(Date) }),
      expect.objectContaining({ status: 'completed' }),
      { status: 'cleaning' },
    ]));
    expect(setup.audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'stay.checked_out' }), setup.tx);
  });

  it('requires cleaning completion before returning a checked-out room to available', async () => {
    const checkedOutStay = { id: 'stay-id', reservationId: reservation.id, checkInAt, checkOutAt };
    const setup = lifecycleService([[], [policy], [{ id: availableRoom.id, status: 'cleaning' }], [checkedOutStay], [{ id: reservation.id, status: 'completed', checkInAt, checkOutAt }], [folio]], [undefined]);

    const result = await setup.service.cleaningComplete(actor, availableRoom.id, 'key', context);

    expect(result.room).toEqual({ id: availableRoom.id, status: 'available' });
    expect(setup.updateValues).toContainEqual({ status: 'available' });
    expect(setup.audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'room.cleaning_completed' }), setup.tx);
  });

  it('creates a walk-in reservation from the current catalog rate and then creates its stay and minimal folio', async () => {
    const setup = lifecycleService(
      [[], [policy], [availableRoom], [identifiedGuest], [{ guestId: identifiedGuest.id }]],
      [[{ id: reservation.id }], undefined, [{ id: 'stay-id' }], undefined, [folio], undefined],
    );
    const input = {
      roomId: availableRoom.id, primaryGuestId: identifiedGuest.id, guestIds: [identifiedGuest.id],
      checkInAt: checkInAt.toISOString(), checkOutAt: checkOutAt.toISOString(), guestCount: 1,
    };

    const result = await setup.service.walkIn(actor, input, 'key', context);

    expect(setup.insertedValues[0]).toEqual(expect.objectContaining({
      propertyId: actor.propertyId, roomId: availableRoom.id, primaryGuestId: identifiedGuest.id,
      status: 'checked_in', nightlyRate: '100.00', totalAmount: '183.33',
    }));
    expect(setup.insertedValues[4]).toEqual({ propertyId: actor.propertyId, stayId: 'stay-id', openingBalance: '0.00' });
    expect(result.reservation).toEqual(expect.objectContaining({ id: reservation.id, status: 'checked_in' }));
    expect(setup.audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'stay.walk_in_checked_in' }), setup.tx);
  });

  it('rolls back invalid and conflicting walk-ins before a reservation, stay, folio, or audit is written', async () => {
    const invalidGuest = lifecycleService([[], [policy], [availableRoom], []]);
    const unavailableRoom = lifecycleService([[], [policy], [{ ...availableRoom, status: 'occupied' }]]);
    const input = {
      roomId: availableRoom.id, primaryGuestId: identifiedGuest.id, guestIds: [identifiedGuest.id],
      checkInAt: checkInAt.toISOString(), checkOutAt: checkOutAt.toISOString(), guestCount: 1,
    };

    await expect(invalidGuest.service.walkIn(actor, input, 'invalid-guest-key', context)).rejects.toBeInstanceOf(ConflictException);
    await expect(unavailableRoom.service.walkIn(actor, input, 'occupied-room-key', context)).rejects.toBeInstanceOf(ConflictException);

    for (const setup of [invalidGuest, unavailableRoom]) {
      expect(setup.tx.insert).not.toHaveBeenCalled();
      expect(setup.tx.update).not.toHaveBeenCalled();
      expect(setup.audit.record).not.toHaveBeenCalled();
    }
  });
});
