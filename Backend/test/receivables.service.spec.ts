import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import { ReceivablesService } from '../src/receivables/receivables.service.js';

const actor = { accountId: 'account-a', propertyId: 'property-a', email: 'a@example.test' } as AuthenticatedAccount;
const context = { requestId: 'receivable-runtime-test' };
const receivable = { id: 'receivable-a', propertyId: actor.propertyId, stayId: 'stay-a', folioId: 'folio-a', status: 'open', originalAmount: '12.50', outstandingAmount: '12.50', reason: 'Debt', openedAt: new Date('2028-01-01T00:00:00Z'), settledAt: null };
const detailRow = { receivable, guest: { id: 'guest-a', firstName: 'Ada', lastName: 'Lovelace', status: 'active' }, reservation: { id: 'reservation-a' }, stay: { id: 'stay-a', status: 'checked_out' }, folio: { id: 'folio-a' } };
const payment = { id: 'entry-a', type: 'payment', amount: '12.50' as any, paymentMethod: 'Tarjeta', reason: null, reversalOfEntryId: null, sourceType: 'receivable_collection', createdAt: new Date('2028-01-02T00:00:00Z') };

function query<T>(value: T) {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'for']) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve);
  return chain;
}

function setup(selects: unknown[][], receipt?: Record<string, unknown>) {
  const inserted: unknown[] = []; const updates: unknown[] = [];
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => query(selects.shift() ?? [])),
    insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { inserted.push(value); return { returning: vi.fn().mockResolvedValue([{ ...receivable, outstandingAmount: '0.00', status: 'settled', settledAt: new Date() }]) }; }) })),
    update: vi.fn(() => ({ set: vi.fn((value: unknown) => { updates.push(value); return { where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ ...receivable, outstandingAmount: '0.00', status: 'settled', settledAt: new Date() }]) })) }; }) })),
  };
  if (receipt) selects.unshift([{ response: receipt }]);
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const folios = { appendLockedReceivableEntry: vi.fn().mockResolvedValue(payment) };
  const database = { transaction: vi.fn((run: (transaction: typeof tx) => unknown) => run(tx)), select: tx.select };
  return { service: new ReceivablesService(database as never, audit as never, folios as never), tx, audit, folios, inserted, updates };
}

describe('receivable runtime behavior', () => {
  it('scenario: List and detail returns only the actor property records and linked history', async () => {
    const list = setup([[{ timezone: 'UTC' }], [{ receivable, guest: detailRow.guest, reservation: detailRow.reservation }]]);
    await expect(list.service.list(actor.propertyId, { status: 'open' })).resolves.toMatchObject([{ id: receivable.id, guest: { id: 'guest-a' } }]);
    const detail = setup([[detailRow], [payment, { ...payment, id: 'reversal-a', type: 'reversal', reversalOfEntryId: payment.id }]]);
    await expect(detail.service.detail(actor.propertyId, receivable.id)).resolves.toMatchObject({ folio: { id: receivable.folioId }, history: [{ id: payment.id }, { id: 'reversal-a' }] });
  });

  it('scenario: Unauthorized property returns not found without disclosure', async () => {
    const subject = setup([[]]);
    await expect(subject.service.detail(actor.propertyId, 'foreign-receivable')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scenario: Filtered list applies status and property-local age filters', async () => {
    const stale = { ...receivable, openedAt: new Date('2020-01-01T00:00:00Z') };
    const subject = setup([[{ timezone: 'UTC' }], [{ receivable, guest: detailRow.guest, reservation: detailRow.reservation }, { receivable: stale, guest: detailRow.guest, reservation: detailRow.reservation }]]);
    await expect(subject.service.list(actor.propertyId, { status: 'open', age: '0_30' })).resolves.toHaveLength(1);
  });

  it('scenario: Detail history excludes unrelated folio entries while preserving collection reversals', async () => {
    const subject = setup([[detailRow], [payment, { ...payment, id: 'manual-a', sourceType: 'manual_payment' }, { ...payment, id: 'reversal-a', type: 'reversal', reversalOfEntryId: payment.id }]]);
    await expect(subject.service.detail(actor.propertyId, receivable.id)).resolves.toMatchObject({ history: [{ id: 'entry-a' }, { id: 'reversal-a' }] });
  });

  it('scenario: Successful collection appends the original folio payment and settles atomically', async () => {
    const subject = setup([[], [receivable], [{ id: receivable.stayId, status: 'checked_out', settlement: 'receivable' }]]);
    await expect(subject.service.collect(actor, receivable.id, { amount: '12.50' as any, method: 'Tarjeta' }, 'key-a', context)).resolves.toMatchObject({ entry: { id: payment.id }, receivable: { status: 'settled', outstandingAmount: '0.00' } });
    expect(subject.folios.appendLockedReceivableEntry).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ folioId: receivable.folioId, stayId: receivable.stayId, sourceType: 'receivable_collection' }), context);
    expect(subject.audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'receivable.collection_approved', propertyId: actor.propertyId }), expect.anything());
  });

  it('scenario: Invalid collection leaves the folio and projection untouched', async () => {
    const subject = setup([[], [{ ...receivable, outstandingAmount: '1.00' }], [{ id: receivable.stayId, status: 'checked_out', settlement: 'receivable' }]]);
    await expect(subject.service.collect(actor, receivable.id, { amount: '1.01' as any, method: 'Tarjeta' }, 'key-b', context)).rejects.toBeInstanceOf(ConflictException);
    expect(subject.folios.appendLockedReceivableEntry).not.toHaveBeenCalled(); expect(subject.updates).toHaveLength(0);
  });

  it('scenario: Retry returns its recorded result without a second payment', async () => {
    const response = { receivable: { id: receivable.id }, entry: { id: payment.id } };
    const subject = setup([], response);
    await expect(subject.service.collect(actor, receivable.id, { amount: '12.50' as any, method: 'Tarjeta' }, 'retry-key', context)).resolves.toEqual(response);
    expect(subject.folios.appendLockedReceivableEntry).not.toHaveBeenCalled(); expect(subject.updates).toHaveLength(0);
  });

  it('scenario: Cash session rejects an actor without an owned open session before mutation', async () => {
    const subject = setup([[], [receivable], [{ id: receivable.stayId, status: 'checked_out', settlement: 'receivable' }], []]);
    await expect(subject.service.collect(actor, receivable.id, { amount: '1.00' as any, method: 'Efectivo' }, 'cash-key', context)).rejects.toBeInstanceOf(ConflictException);
    expect(subject.folios.appendLockedReceivableEntry).not.toHaveBeenCalled(); expect(subject.updates).toHaveLength(0);
  });

  it('scenario: Audit and reversal append an immutable link and reopen only a settled receivable', async () => {
    const settled = { ...receivable, status: 'settled', outstandingAmount: '0.00' };
    const subject = setup([[], [settled], [payment], []]);
    await expect(subject.service.reverse(actor, settled.id, payment.id, { reason: 'Correction' }, 'reverse-key', context)).resolves.toMatchObject({ entry: { id: payment.id } });
    expect(subject.folios.appendLockedReceivableEntry).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ sourceType: 'receivable_reversal', reversalOfEntryId: payment.id, folioId: settled.folioId }), context);
    expect(subject.audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'receivable.reversal_approved', metadata: expect.objectContaining({ reversalOfEntryId: payment.id }) }), expect.anything());
  });
});
