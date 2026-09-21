import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import { AuditService } from '../src/audit/audit.service.js';
import { OutboxController } from '../src/audit/outbox.controller.js';
import { OutboxService } from '../src/audit/outbox.service.js';

const actor = {
  accountId: 'account-id',
  propertyId: 'property-id',
  roleKey: 'administrator',
  email: 'admin@example.invalid',
  permissions: ['audit.read', 'audit.manage'],
  sessionId: 'session-id',
  passwordChangeRequired: false,
} satisfies AuthenticatedAccount;

describe('OutboxController', () => {
  it('lists only the requested property and validated status window', async () => {
    const listEvents = vi.fn().mockResolvedValue([{ id: 'event-id' }]);
    const controller = new OutboxController(
      {} as Database,
      { listEvents } as unknown as OutboxService,
      {} as AuditService,
    );

    await expect(controller.list(actor, 'dead_letter', '20', '2')).resolves.toEqual([{ id: 'event-id' }]);
    expect(listEvents).toHaveBeenCalledWith(actor.propertyId, 'dead_letter', 20, 2);
  });

  it('requeues a dead-letter event and audits the action in the same transaction', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440000';
    const event = { id: eventId, eventType: 'notification:new', status: 'pending' };
    const requeueDeadLetter = vi.fn().mockResolvedValue(event);
    const record = vi.fn().mockResolvedValue(undefined);
    const tx = {};
    const database = {
      transaction: vi.fn(async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx)),
    };
    const controller = new OutboxController(
      database as unknown as Database,
      { requeueDeadLetter } as unknown as OutboxService,
      { record } as unknown as AuditService,
    );

    await expect(controller.requeue(actor, eventId, {
      id: 'request-id',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
    } as any)).resolves.toBe(event);

    expect(requeueDeadLetter).toHaveBeenCalledWith(tx, actor.propertyId, eventId);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'outbox.dead_letter.requeued',
      actorAccountId: actor.accountId,
      subjectId: eventId,
      propertyId: actor.propertyId,
      requestId: 'request-id',
    }), tx);
  });
});
