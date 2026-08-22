import { describe, expect, it, vi } from 'vitest';
import { AuditService, type AuditExecutor } from '../src/audit/audit.service.js';
import { auditEvents } from '../src/database/schema/index.js';

type AuditEventRow = typeof auditEvents.$inferInsert;

function createExecutor(error?: Error) {
  const values = vi.fn<(events: AuditEventRow | AuditEventRow[]) => Promise<void>>(
    error ? async () => { throw error; } : async () => undefined,
  );
  const insert = vi.fn((_table: typeof auditEvents) => ({ values }));
  const executor: AuditExecutor = { insert };
  return { executor, insert, values };
}

describe('AuditService', () => {
  it('uses the injected database executor by default', async () => {
    const database = createExecutor();
    const service = new AuditService(database.executor);

    await service.record({ eventType: 'auth.login.failed', requestId: 'request-id' });

    expect(database.insert).toHaveBeenCalledWith(auditEvents);
    expect(database.values).toHaveBeenCalledWith({
      eventType: 'auth.login.failed',
      requestId: 'request-id',
      metadata: {},
    });
  });

  it('uses an explicit transaction executor when provided', async () => {
    const database = createExecutor();
    const transaction = createExecutor();
    const service = new AuditService(database.executor);

    await service.record({ eventType: 'account.created' }, transaction.executor);

    expect(database.insert).not.toHaveBeenCalled();
    expect(transaction.insert).toHaveBeenCalledWith(auditEvents);
    expect(transaction.values).toHaveBeenCalledWith({ eventType: 'account.created', metadata: {} });
  });

  it('inserts and sanitizes every event in recordMany', async () => {
    const database = createExecutor();
    const service = new AuditService(database.executor);

    await service.recordMany([
      { eventType: 'first', metadata: { safe: 'kept', token: 'removed' } },
      { eventType: 'second', subjectId: 'subject-id', metadata: { nested: { password: 'removed', count: 2 } } },
    ]);

    expect(database.values).toHaveBeenCalledWith([
      { eventType: 'first', metadata: { safe: 'kept' } },
      { eventType: 'second', subjectId: 'subject-id', metadata: { nested: { count: 2 } } },
    ]);
  });

  it('does not insert an empty recordMany batch', async () => {
    const database = createExecutor();
    const service = new AuditService(database.executor);

    await service.recordMany([]);

    expect(database.insert).not.toHaveBeenCalled();
    expect(database.values).not.toHaveBeenCalled();
  });

  it('propagates recordMany rejection from an explicit executor', async () => {
    const insertionError = new Error('batch insert failed');
    const database = createExecutor();
    const transaction = createExecutor(insertionError);
    const service = new AuditService(database.executor);

    await expect(service.recordMany([{ eventType: 'failed.batch' }], transaction.executor)).rejects.toBe(insertionError);
    expect(database.insert).not.toHaveBeenCalled();
  });

  it('recursively removes case-insensitive sensitive keys from objects and arrays', async () => {
    const database = createExecutor();
    const service = new AuditService(database.executor);

    await service.record({
      eventType: 'metadata.checked',
      metadata: {
        Password: 'removed',
        profile: {
          displayName: 'Safe Name',
          AUTHORIZATION: 'removed',
          items: [
            { Cookie: 'removed', value: 1 },
            { nested: { accessToken: 'removed', publicValue: true } },
            'preserved',
          ],
        },
        clientSecret: 'removed',
      },
    });

    expect(database.values).toHaveBeenCalledWith({
      eventType: 'metadata.checked',
      metadata: {
        profile: {
          displayName: 'Safe Name',
          items: [
            { value: 1 },
            { nested: { publicValue: true } },
            'preserved',
          ],
        },
      },
    });
  });

  it('propagates insertion errors', async () => {
    const insertionError = new Error('insert failed');
    const database = createExecutor(insertionError);
    const service = new AuditService(database.executor);

    await expect(service.record({ eventType: 'failed.write' })).rejects.toBe(insertionError);
  });
});
