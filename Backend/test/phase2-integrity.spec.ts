import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
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

  it('enqueues a property and stay-scoped event through the transaction executor', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const service = new OutboxService({} as any);

    await service.enqueue({ insert } as any, {
      propertyId: 'property-1',
      stayId: 'stay-1',
      eventType: 'notification:new',
      aggregateType: 'audit',
      aggregateId: 'audit-1',
      requestId: 'request-1',
      payload: { title: 'Created' },
    });

    expect(insert).toHaveBeenCalledWith(outboxEvents);
    expect(values).toHaveBeenCalledWith({
      propertyId: 'property-1',
      stayId: 'stay-1',
      eventType: 'notification:new',
      aggregateType: 'audit',
      aggregateId: 'audit-1',
      requestId: 'request-1',
      payload: { title: 'Created' },
    });
  });

  it('rejects stay-scoped events without a property scope', async () => {
    const insert = vi.fn();
    const service = new OutboxService({} as any);

    await expect(service.enqueue({ insert } as any, {
      stayId: 'stay-1',
      eventType: 'notification:new',
      payload: { title: 'Created' },
    })).rejects.toThrow('Stay-scoped outbox messages require a propertyId');
    expect(insert).not.toHaveBeenCalled();
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

  it('dispatches stay-scoped events to the stay room before considering the property room', async () => {
    const row = {
      id: 'outbox-stay-1',
      propertyId: 'property-1',
      stayId: 'stay-1',
      eventType: 'order:created',
      payload: { orderId: 'order-1' },
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
    const realtime = { emitToProperty: vi.fn(), emitToStay: vi.fn() };
    const service = new OutboxService(database as any, realtime as any);

    await expect(service.dispatchPending()).resolves.toBe(1);

    expect(realtime.emitToStay).toHaveBeenCalledWith('stay-1', 'order:created', row.payload);
    expect(realtime.emitToProperty).not.toHaveBeenCalled();
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
      lockToken: null,
      errorCode: 'REALTIME_UNAVAILABLE',
      lastError: 'REALTIME_UNAVAILABLE',
      availableAt: expect.any(Date),
    }));
  });

  it('moves permanent failures directly to dead letter without retrying', async () => {
    const row = {
      id: 'outbox-permanent-1',
      propertyId: 'property-1',
      eventType: 'notification:new',
      payload: { title: 'Created' },
      attempts: 0,
      maxAttempts: 8,
    };
    const tx = dispatchTransaction(row);
    const database = dispatchDatabase(tx);
    const realtime = { emitToProperty: vi.fn(() => { throw Object.assign(new Error('invalid target'), { statusCode: 400 }); }) };
    const service = new OutboxService(database as any, realtime as any);

    await expect(service.dispatchPending()).resolves.toBe(1);

    const updates = database.update.mock.results.map((result: any) => result.value.set.mock.calls[0]?.[0]);
    expect(updates).toContainEqual(expect.objectContaining({
      status: 'dead_letter',
      failedAt: expect.any(Date),
      errorCode: 'HTTP_400',
      lastError: 'HTTP_400',
    }));
    expect(updates).not.toContainEqual(expect.objectContaining({ status: 'pending' }));
  });

  it('moves exhausted transient failures to dead letter', async () => {
    const row = {
      id: 'outbox-exhausted-1',
      propertyId: 'property-1',
      eventType: 'notification:new',
      payload: { title: 'Created' },
      attempts: 7,
      maxAttempts: 8,
    };
    const tx = dispatchTransaction(row);
    const database = dispatchDatabase(tx);
    const realtime = { emitToProperty: vi.fn(() => { throw new Error('socket unavailable'); }) };
    const service = new OutboxService(database as any, realtime as any);

    await expect(service.dispatchPending()).resolves.toBe(1);

    const updates = database.update.mock.results.map((result: any) => result.value.set.mock.calls[0]?.[0]);
    expect(updates).toContainEqual(expect.objectContaining({ status: 'dead_letter', errorCode: 'REALTIME_UNAVAILABLE' }));
    expect(updates).not.toContainEqual(expect.objectContaining({ status: 'pending' }));
  });

  it('reclaims stale processing events with a new fencing token', async () => {
    const row = {
      id: 'outbox-stale-1',
      propertyId: 'property-1',
      eventType: 'notification:new',
      payload: { title: 'Created' },
      status: 'processing',
      attempts: 1,
      maxAttempts: 8,
      lockedAt: new Date(Date.now() - 120_000),
    };
    const tx = dispatchTransaction(row);
    const database = dispatchDatabase(tx);
    const realtime = { emitToProperty: vi.fn() };
    const service = new OutboxService(database as any, realtime as any);

    await expect(service.dispatchPending()).resolves.toBe(1);

    const claim = tx.update.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(claim).toMatchObject({ status: 'processing', attempts: 2, lockToken: expect.any(String) });
    expect(realtime.emitToProperty).toHaveBeenCalledOnce();
  });

  it('requeues dead-letter events while clearing terminal failure state', async () => {
    const row = {
      id: 'outbox-requeue-1',
      propertyId: 'property-1',
      stayId: null,
      eventType: 'notification:new',
      aggregateType: 'audit',
      aggregateId: 'audit-1',
      requestId: null,
      status: 'dead_letter',
      attempts: 8,
      maxAttempts: 8,
      availableAt: new Date(),
      lockedAt: null,
      lockToken: null,
      processedAt: null,
      failedAt: new Date(),
      errorCode: 'HTTP_400',
      lastError: 'HTTP_400',
      createdAt: new Date(),
      payload: { secret: 'not returned' },
    };
    const returning = vi.fn().mockResolvedValue([{ ...row, status: 'pending', attempts: 0, failedAt: null, errorCode: null, lastError: null }]);
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) });
    const service = new OutboxService({} as any);

    const result = await service.requeueDeadLetter({ update: vi.fn().mockReturnValue({ set }) } as any, 'property-1', row.id);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', attempts: 0, failedAt: null, errorCode: null }));
    expect(result).toMatchObject({ id: row.id, status: 'pending', attempts: 0 });
    expect(result).not.toHaveProperty('payload');
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
    expect(new PgDialect().sqlToQuery(where.mock.calls[1]![0]).params)
      .toContain('2030-01-01T12:00:00.000Z');
  });
});

function dispatchTransaction(row: unknown) {
  return {
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
}

function dispatchDatabase(tx: ReturnType<typeof dispatchTransaction>) {
  return {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
  };
}
