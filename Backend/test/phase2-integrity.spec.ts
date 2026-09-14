import { describe, expect, it, vi } from 'vitest';
import { OutboxService } from '../src/audit/outbox.service.js';
import { requestFingerprint } from '../src/database/idempotency.js';
import { outboxEvents } from '../src/database/schema/commands.schema.js';
import { ExperiencesService } from '../src/experiences/experiences.service.js';

describe('phase 2 integrity primitives', () => {
  it('builds the same fingerprint for equivalent object key order', () => {
    expect(requestFingerprint({ b: 2, a: 1 })).toBe(requestFingerprint({ a: 1, b: 2 }));
    expect(requestFingerprint({ at: new Date('2026-01-01T00:00:00.000Z') }))
      .toBe(requestFingerprint({ at: '2026-01-01T00:00:00.000Z' }));
    expect(requestFingerprint({ a: 1 })).not.toBe(requestFingerprint({ a: 2 }));
  });

  it('enqueues a property event through the transaction executor', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const service = new OutboxService({} as any);

    await service.enqueue({ insert } as any, {
      propertyId: 'property-1',
      eventType: 'notification:new',
      aggregateType: 'audit',
      aggregateId: 'audit-1',
      payload: { title: 'Created' },
    });

    expect(insert).toHaveBeenCalledWith(outboxEvents);
    expect(values).toHaveBeenCalledWith({
      propertyId: 'property-1',
      eventType: 'notification:new',
      aggregateType: 'audit',
      aggregateId: 'audit-1',
      payload: { title: 'Created' },
    });
  });

  it('marks dispatched events as sent', async () => {
    const row = {
      id: 'outbox-1',
      propertyId: 'property-1',
      eventType: 'notification:new',
      payload: { title: 'Created' },
      attempts: 0,
    };
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([row]),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    const database = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    const realtime = { emitToProperty: vi.fn() };
    const service = new OutboxService(database as any, realtime as any);

    await expect(service.dispatchPending()).resolves.toBe(1);

    expect(realtime.emitToProperty).toHaveBeenCalledWith('property-1', 'notification:new', row.payload);
    expect(database.update).toHaveBeenCalledWith(outboxEvents);
    const sentUpdate = database.update.mock.results[database.update.mock.results.length - 1]!.value;
    expect(sentUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
  });

  it('dispatches global events when they are not property-scoped', async () => {
    const row = {
      id: 'outbox-global-1',
      propertyId: null,
      eventType: 'system:notice',
      payload: { message: 'Maintenance' },
      attempts: 0,
    };
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([row]),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    const database = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    const realtime = { emitToProperty: vi.fn(), emitToAll: vi.fn() };
    const service = new OutboxService(database as any, realtime as any);

    await expect(service.dispatchPending()).resolves.toBe(1);

    expect(realtime.emitToAll).toHaveBeenCalledWith('system:notice', row.payload);
    expect(realtime.emitToProperty).not.toHaveBeenCalled();
  });

  it('returns failed events to pending with a retry timestamp', async () => {
    const row = {
      id: 'outbox-2',
      propertyId: 'property-1',
      eventType: 'notification:new',
      payload: { title: 'Created' },
      attempts: 1,
    };
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([row]),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    const database = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    const realtime = { emitToProperty: vi.fn(() => { throw new Error('socket unavailable'); }) };
    const service = new OutboxService(database as any, realtime as any);

    await expect(service.dispatchPending()).resolves.toBe(1);

    const retryUpdate = database.update.mock.results[database.update.mock.results.length - 1]!.value;
    expect(retryUpdate.set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      lockedAt: null,
      lastError: 'socket unavailable',
      availableAt: expect.any(Date),
    }));
  });

  it('treats PostgreSQL aggregate values as numbers when checking experience capacity', async () => {
    const receiptWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
    const capacityWhere = vi.fn().mockResolvedValue([{ totalPax: '1' }]);
    const where = vi.fn()
      .mockReturnValueOnce(receiptWhere())
      .mockReturnValueOnce(capacityWhere());
    const returning = vi.fn().mockResolvedValue([{ id: 'participation-1' }]);
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      query: {
        accounts: { findFirst: vi.fn().mockResolvedValue({ id: 'account-1' }) },
        experiences: { findFirst: vi.fn().mockResolvedValue({ id: 'experience-1', status: 'PUBLISHED', maxCapacity: 2, requiresReservation: false }) },
        guests: { findFirst: vi.fn().mockResolvedValue({ id: 'guest-1' }) },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning }),
      }),
    };
    const database = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ExperiencesService(database as any);

    await expect(service.registerParticipation('property-1', 'account-1', 'experience-1', {
      guestId: 'guest-1',
      pax: 1,
      scheduledAt: '2030-01-01T12:00:00.000Z',
      idempotencyKey: 'experience-key',
    } as any, {})).resolves.toEqual({ id: 'participation-1' });
  });
});
