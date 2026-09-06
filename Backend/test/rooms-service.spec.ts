import { ConflictException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import { RoomsService } from '../src/rooms/rooms.service.js';

const actor = { accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist', email: 'user@example.com', permissions: ['rooms.read', 'rooms.update', 'rooms.block'], sessionId: 'session-id', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const createdAt = new Date('2026-08-14T12:00:00.000Z');
const row = {
  id: 'room-id', number: '101', floor: 1, status: 'available' as const, createdAt,
  categoryId: 'category-id', categoryCode: 'SIMPLE', categoryName: 'Simple', categoryCapacity: 1,
  categoryBaseNightlyRate: '95.00', categoryCreatedAt: createdAt,
};
type RoomRow = Omit<typeof row, 'status'> & { status: 'available' | 'reserved' | 'occupied' | 'cleaning' | 'maintenance' | 'blocked' | 'out_of_service' };

function queryResult<T>(value: T) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (result: T) => unknown) => Promise<unknown>)> = {};
  for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve);
  return query;
}

function mutationService(current: RoomRow | null = row) {
  const selected = queryResult(current ? [current] : []);
  const returning = vi.fn().mockResolvedValue([{ id: row.id, number: row.number, floor: row.floor, status: row.status, createdAt }]);
  const update = { set: vi.fn(() => update), where: vi.fn(() => update), returning };
  const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(() => selected), update: vi.fn(() => update), insert: vi.fn() };
  const database = { transaction: vi.fn((callback) => callback(tx)) } as unknown as Database;
  const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const realtime = { emitToProperty: vi.fn(), emitToStay: vi.fn() };
  return { service: new RoomsService(database, audit, realtime as any), tx, selected, update, audit };
}

describe('RoomsService', () => {
  it('lists scoped rooms and categories with deterministic ordering and no property projection', async () => {
    const categories = queryResult([{ id: 'category-id', code: 'SIMPLE', name: 'Simple', capacity: 1, baseNightlyRate: '95.00', createdAt }]);
    const roomRows = queryResult([row]);
    const database = { select: vi.fn().mockReturnValueOnce(categories).mockReturnValueOnce(roomRows) } as unknown as Database;
    const result = await new RoomsService(database, {} as AuditService).list(actor.propertyId);
    expect(new PgDialect().sqlToQuery(vi.mocked(categories.where as ReturnType<typeof vi.fn>).mock.calls[0]![0]).params).toEqual([actor.propertyId]);
    expect(vi.mocked(categories.orderBy as ReturnType<typeof vi.fn>).mock.calls[0]).toHaveLength(3);
    expect(vi.mocked(roomRows.orderBy as ReturnType<typeof vi.fn>).mock.calls[0]).toHaveLength(3);
    expect(result.rooms[0]).toEqual(expect.objectContaining({ id: row.id, createdAt: createdAt.toISOString(), category: expect.objectContaining({ baseNightlyRate: '95.00' }) }));
    expect(JSON.stringify(result)).not.toContain('propertyId');
  });

  it('returns a no-op without update or audit and hides out-of-property rooms', async () => {
    const current = mutationService();
    await expect(current.service.update(actor, row.id, { number: row.number }, {})).resolves.toMatchObject({ id: row.id });
    expect(current.tx.execute.mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(current.selected.for as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!);
    expect(current.selected.for).toHaveBeenCalledWith('update');
    const where = vi.mocked(current.selected.where as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(new PgDialect().sqlToQuery(where).params).toEqual([row.id, actor.propertyId]);
    expect(current.tx.update).not.toHaveBeenCalled();
    expect(current.audit.record).not.toHaveBeenCalled();
    const missing = mutationService(null);
    await expect(missing.service.update(actor, row.id, { number: '102' }, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates changed categories in the actor property', async () => {
    const scoped = mutationService();
    vi.mocked(scoped.tx.select).mockReturnValueOnce(scoped.selected as never).mockReturnValueOnce(queryResult([]) as never);
    await expect(scoped.service.update(actor, row.id, { categoryId: 'other-category-id' }, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts a category selected from the actor property', async () => {
    const scoped = mutationService();
    const category = { id: 'other-category-id', code: 'DOBLE', name: 'Doble', capacity: 2, baseNightlyRate: '145.00', createdAt };
    vi.mocked(scoped.tx.select).mockReturnValueOnce(scoped.selected as never).mockReturnValueOnce(queryResult([category]) as never);
    const result = await scoped.service.update(actor, row.id, { categoryId: category.id }, {});
    expect(result.category).toEqual(expect.objectContaining({ id: category.id, baseNightlyRate: '145.00' }));
    expect(scoped.update.set).toHaveBeenCalledWith({ categoryId: category.id });
  });

  it('audits only changed field names through the same transaction and propagates audit failure', async () => {
    const changed = mutationService();
    vi.mocked(changed.update.returning).mockResolvedValueOnce([{ id: row.id, number: '102', floor: row.floor, status: row.status, createdAt }]);
    await changed.service.update(actor, row.id, { number: '102' }, { requestId: 'request-id' });
    expect(changed.audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'room.updated', metadata: { fields: ['number'] } }), changed.tx);
    const failed = mutationService();
    const error = new Error('audit unavailable');
    vi.mocked(failed.audit.record).mockRejectedValueOnce(error);
    await expect(failed.service.update(actor, row.id, { number: '102' }, {})).rejects.toBe(error);
  });

  it('maps only room-number uniqueness to conflict', async () => {
    const known = new RoomsService({ transaction: vi.fn().mockRejectedValue({ code: '23505', constraint: 'rooms_property_id_number_key' }) } as unknown as Database, {} as AuditService);
    await expect(known.update(actor, row.id, { number: '102' }, {})).rejects.toBeInstanceOf(ConflictException);
    const unknownError = { code: '23505', constraint: 'future_constraint' };
    const unknown = new RoomsService({ transaction: vi.fn().mockRejectedValue(unknownError) } as unknown as Database, {} as AuditService);
    await expect(unknown.update(actor, row.id, { number: '102' }, {})).rejects.toBe(unknownError);
  });

  it.each([
    ['available', true, true], ['blocked', false, true], ['available', false, false], ['blocked', true, false],
    ['reserved', true, 'conflict'], ['reserved', false, 'conflict'], ['occupied', true, 'conflict'], ['occupied', false, 'conflict'],
    ['cleaning', true, 'conflict'], ['cleaning', false, 'conflict'], ['maintenance', true, 'conflict'], ['maintenance', false, 'conflict'],
    ['out_of_service', true, 'conflict'], ['out_of_service', false, 'conflict'],
  ] as const)('enforces block transition from %s to blocked=%s', async (status, blocked, outcome) => {
    const setup = mutationService({ ...row, status: status as RoomRow['status'] });
    if (outcome === 'conflict') {
      await expect(setup.service.setBlocked(actor, row.id, { blocked, reason: 'Safety review' }, {})).rejects.toBeInstanceOf(ConflictException);
      expect(setup.audit.record).not.toHaveBeenCalled();
    } else {
      await setup.service.setBlocked(actor, row.id, { blocked, reason: 'Safety review' }, {});
      expect(setup.tx.update).toHaveBeenCalledTimes(outcome ? 1 : 0);
      expect(setup.audit.record).toHaveBeenCalledTimes(outcome ? 1 : 0);
      if (outcome) expect(setup.audit.record).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ reason: 'Safety review', previousStatus: status }) }), setup.tx);
    }
  });
});
