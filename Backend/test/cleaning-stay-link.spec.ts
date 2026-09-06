import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../src/auth/auth.types.js';
import { CleaningService } from '../src/cleaning/cleaning.service.js';
import type { Database } from '../src/database/database.module.js';
import type { RealtimeGateway } from '../src/realtime/realtime.gateway.js';

const actor: AuthenticatedAccount = {
  accountId: 'account-id', propertyId: 'property-id', roleKey: 'cleaning', email: 'cleaning@example.invalid',
  permissions: ['cleaning.progress'], sessionId: 'session-id', passwordChangeRequired: false,
};
const context: RequestContext = { requestId: 'request-id' };
const task = {
  id: 'task-id', propertyId: actor.propertyId, roomId: 'room-id', stayId: 'stay-id', status: 'completed',
  assignedTo: 'Housekeeping', reason: 'Check-out completed', observation: null, evidence: [],
  startedAt: new Date('2028-03-01T12:00:00.000Z'), completedAt: new Date('2028-03-01T12:30:00.000Z'),
  createdAt: new Date('2028-03-01T11:00:00.000Z'), updatedAt: new Date('2028-03-01T12:30:00.000Z'),
};

function queryResult<T>(value: T) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (result: T) => unknown, reject?: (error: unknown) => unknown) => Promise<unknown>)> = {};
  for (const method of ['from', 'where', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(value).then(resolve, reject);
  return query;
}

function cleaningService(selections: unknown[][]) {
  const updateValues: unknown[] = [];
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => queryResult(selections.shift() ?? [])),
    update: vi.fn(() => {
      const update = { set: vi.fn((values: unknown) => { updateValues.push(values); return update; }), where: vi.fn(() => update) };
      return update;
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'incident-id', status: 'closed', blocksRoom: false }]) })),
    })),
  };
  const database = { transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as unknown as Database;
  const realtime = { emitToProperty: vi.fn() };
  return {
    service: new CleaningService(database, { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService, realtime as unknown as RealtimeGateway),
    updateValues,
  };
}

describe('CleaningService stay linkage', () => {
  it('releases a room only after approving the task linked to its checked-out stay', async () => {
    const setup = cleaningService([[], [task], [{ id: task.stayId }], [{ id: task.roomId, status: 'cleaning' }], []]);

    const result = await setup.service.progressTask(actor, task.id, { expectedStatus: 'completed' }, 'key', context);

    expect(result.room).toEqual({ id: task.roomId, status: 'available' });
    expect(setup.updateValues).toEqual(expect.arrayContaining([{ status: 'available' }]));
  });

  it('rejects approval when the linked stay is no longer a checked-out stay', async () => {
    const setup = cleaningService([[], [task], []]);

    await expect(setup.service.progressTask(actor, task.id, { expectedStatus: 'completed' }, 'key', context)).rejects.toBeInstanceOf(ConflictException);

    expect(setup.updateValues).toEqual([]);
  });
});
