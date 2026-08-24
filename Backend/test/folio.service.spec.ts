import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount, RequestContext } from '../src/auth/auth.types.js';
import type { AuditService } from '../src/audit/audit.service.js';
import type { Database } from '../src/database/database.module.js';
import { FolioService } from '../src/folios/folio.service.js';

const actor = { accountId: 'account', propertyId: 'property', email: 'cashier@example.invalid', permissions: [], roleKey: 'cashier', sessionId: 'session', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const context: RequestContext = { requestId: 'request' };
const state = (entries: any[] = [], balance = '0.00') => ({ folio: { id: 'folio', stayId: 'stay', openingBalance: '0.00' }, entries, balance, settlement: 'open', receivable: null });

function service() {
  const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(), insert: vi.fn() };
  const database = { transaction: vi.fn((run: (transaction: typeof tx) => unknown) => run(tx)) } as unknown as Database;
  return { service: new FolioService(database, { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService), tx };
}

describe('FolioService financial command behavior', () => {
  it('derives the signed balance from immutable charge, payment, and reversal history', async () => {
    const setup = service();
    const selections = [[{ id: 'stay', settlement: 'open', receivableAmount: null, receivableReason: null }], [{ id: 'folio' }], [
      { id: 'charge', type: 'charge', amount: '12.50', reversalOfEntryId: null },
      { id: 'payment', type: 'payment', amount: '5.00', reversalOfEntryId: null },
      { id: 'reversal', type: 'reversal', amount: '5.00', reversalOfEntryId: 'payment' },
    ]];
    setup.tx.select.mockImplementation(() => chain(selections.shift() ?? []));

    await expect(setup.service.read(setup.tx, actor.propertyId, 'stay')).resolves.toMatchObject({ balance: '12.50', entries: expect.arrayContaining([expect.objectContaining({ id: 'charge' })]) });
  });

  it('returns an idempotent retry without inserting another charge and rejects missing property stays before writes', async () => {
    const replay = service();
    vi.spyOn(replay.service, 'read').mockResolvedValue(state());
    vi.spyOn(replay.service as any, 'findByIdempotencyKey').mockResolvedValue({ id: 'existing' });
    const insert = vi.spyOn(replay.service as any, 'insert');
    await replay.service.charge(actor, 'stay', { amount: '4.00', description: 'Laundry' }, 'charge-key', context);
    expect(replay.tx.execute).toHaveBeenCalledOnce();
    expect(insert).not.toHaveBeenCalled();

    const foreign = service();
    vi.spyOn(foreign.service as any, 'findByIdempotencyKey').mockResolvedValue(undefined);
    vi.spyOn(foreign.service, 'read').mockRejectedValue(new NotFoundException('Stay not found'));
    await expect(foreign.service.charge(actor, 'foreign-stay', { amount: '4.00', description: 'Laundry' }, 'foreign-key', context)).rejects.toBeInstanceOf(NotFoundException);
    expect(foreign.tx.insert).not.toHaveBeenCalled();
  });

  it('replays a compatible ancillary source with its real UUID without a second audit', async () => {
    const setup = service();
    setup.tx.select.mockImplementation(() => chain([]));
    const insert = vi.spyOn(setup.service as any, 'insert').mockResolvedValue({ id: '8e6c4ee6-555d-58ed-9015-6fce38b513ea' });
    await expect(setup.service.appendAncillaryChargeLocked(setup.tx, actor, { stayId: 'stay', sourceType: 'parking_exit', sourceId: 'VEH-1', amount: '8.00', reason: 'Parking exit' }, context)).resolves.toEqual({ id: '8e6c4ee6-555d-58ed-9015-6fce38b513ea' });
    expect(insert).toHaveBeenCalledOnce();
  });

  it('scenario: Post-settlement ancillary posting is rejected before a ledger insert', async () => {
    const setup = service();
    const selections = [[], [], [{ id: 'stay', settlement: 'settled', receivableAmount: null, receivableReason: null }], [{ id: 'folio' }], []];
    setup.tx.select.mockImplementation(() => chain(selections.shift() ?? []));

    await expect(setup.service.appendAncillaryChargeLocked(setup.tx, actor, { stayId: 'stay', sourceType: 'pet_charge', sourceId: 'PET-1', amount: '5.00', reason: 'Pet lodging charge' }, context)).rejects.toBeInstanceOf(ConflictException);
    expect(setup.tx.insert).not.toHaveBeenCalled();
  });

  it('scenario: Checkout contention uses the locked stay before the ancillary insert', async () => {
    const setup = commandSetup([[], [], [stayRow], [folioRow], []], [{ id: 'entry-id' }]);

    await expect(setup.service.appendAncillaryChargeLocked(setup.tx, actor, { stayId: 'stay', sourceType: 'parking_exit', sourceId: 'VEH-LOCK', amount: '8.00', reason: 'Parking exit' }, context)).resolves.toEqual({ id: 'entry-id' });
    expect(setup.tx.select.mock.results[2]!.value.for).toHaveBeenCalledWith('update', expect.anything());
    expect(setup.inserted).toContainEqual(expect.objectContaining({ sourceType: 'parking_exit', sourceId: 'VEH-LOCK', amount: '8.00' }));
  });

  it('rejects overpayment before ledger insertion and accepts a true partial Tarjeta payment without cash movement', async () => {
    const setup = service();
    const read = vi.spyOn(setup.service, 'read').mockResolvedValue(state([], '4.00'));
    vi.spyOn(setup.service as any, 'findByIdempotencyKey').mockResolvedValue(undefined);
    const insert = vi.spyOn(setup.service as any, 'insert');
    await expect(setup.service.payment(actor, 'stay', { amount: '4.01', method: 'Tarjeta' }, 'payment-key', context)).rejects.toBeInstanceOf(ConflictException);
    expect(read).toHaveBeenCalledWith(setup.tx, actor.propertyId, 'stay', true);
    expect(insert).not.toHaveBeenCalled();

    const partial = commandSetup([[ ], [stayRow], [folioRow], [charge], [], [stayRow], [folioRow], [charge, cardPayment]], [cardPayment]);
    await expect(partial.service.payment(actor, 'stay', { amount: '4.00', method: 'Tarjeta' }, 'card-key', context)).resolves.toMatchObject({ balance: '6.00' });
    expect(partial.inserted).toEqual([expect.objectContaining({ type: 'payment', amount: '4.00', paymentMethod: 'Tarjeta' })]);
  });

  it('creates exactly one referenced Ingreso for Efectivo payment and one linked Egreso for its public-command reversal', async () => {
    const setup = service();
    vi.spyOn(setup.service, 'read').mockResolvedValue(state([], '10.00'));
    vi.spyOn(setup.service as any, 'findByIdempotencyKey').mockResolvedValue(undefined);
    const cashSession = vi.spyOn(setup.service as any, 'assertOpenCashSession').mockRejectedValue(new ConflictException('closed'));
    const insert = vi.spyOn(setup.service as any, 'insert');
    await expect(setup.service.payment(actor, 'stay', { amount: '5.00', method: 'Efectivo' }, 'cash-key', context)).rejects.toBeInstanceOf(ConflictException);
    expect(insert).not.toHaveBeenCalled();
    cashSession.mockRestore();

    const payment = commandSetup([[], [stayRow], [folioRow], [charge], [openSession], [], [openSession], [stayRow], [folioRow], [charge, cashPayment]], [cashPayment]);
    await payment.service.payment(actor, 'stay', { amount: '5.00', method: 'Efectivo' }, 'cash-key', context);
    expect(payment.inserted).toEqual([
      expect.objectContaining({ type: 'payment', idempotencyKey: 'cash-key' }),
      expect.objectContaining({ type: 'Ingreso', referenceId: 'cash-payment', method: 'Efectivo' }),
    ]);

    const reversal = commandSetup([[], [cashPayment], [], [openSession], [stayRow], [folioRow], [charge, cashPayment], [], [openSession], [stayRow], [folioRow], [charge, cashPayment, cashReversal]], [cashReversal]);
    await expect(reversal.service.reverse(actor, 'stay', 'cash-payment', { reason: 'Correction' }, 'cash-reversal-key', context)).resolves.toMatchObject({ balance: '10.00' });
    expect(reversal.inserted).toEqual([
      expect.objectContaining({ type: 'reversal', reversalOfEntryId: 'cash-payment', reason: 'Correction' }),
      expect.objectContaining({ type: 'Egreso', referenceId: 'cash-reversal', method: 'Efectivo' }),
    ]);
  });

  it('reverses a non-cash payment once through the public command without mutating the original or creating cash movement', async () => {
    const original = { ...cardPayment };
    const reversal = commandSetup([[], [original], [], [stayRow], [folioRow], [charge, original], [], [stayRow], [folioRow], [charge, original, cardReversal]], [cardReversal]);
    await reversal.service.reverse(actor, 'stay', 'card-payment', { reason: 'Correction' }, 'card-reversal-key', context);
    expect(original).toEqual(cardPayment);
    expect(reversal.inserted).toEqual([expect.objectContaining({ type: 'reversal', reversalOfEntryId: 'card-payment' })]);
    expect(reversal.inserted).not.toContainEqual(expect.objectContaining({ type: expect.stringMatching(/Ingreso|Egreso/) }));

    const duplicate = service();
    vi.spyOn(duplicate.service as any, 'findByIdempotencyKey').mockResolvedValue(undefined);
    duplicate.tx.select.mockImplementationOnce(() => chain([original])).mockImplementationOnce(() => chain([{ id: 'prior-reversal' }]));
    await expect(duplicate.service.reverse(actor, 'stay', 'card-payment', { reason: 'Again' }, 'duplicate-key', context)).rejects.toBeInstanceOf(ConflictException);
    expect(duplicate.tx.insert).not.toHaveBeenCalled();
  });
});

const stayRow = { id: 'stay', settlement: 'open', receivableAmount: null, receivableReason: null };
const folioRow = { id: 'folio' };
const charge = { id: 'charge', type: 'charge', amount: '10.00', reversalOfEntryId: null };
const cardPayment = { id: 'card-payment', type: 'payment', amount: '4.00', paymentMethod: 'Tarjeta', reversalOfEntryId: null };
const cashPayment = { id: 'cash-payment', type: 'payment', amount: '5.00', paymentMethod: 'Efectivo', reversalOfEntryId: null };
const cardReversal = { id: 'card-reversal', type: 'reversal', amount: '4.00', reversalOfEntryId: 'card-payment' };
const cashReversal = { id: 'cash-reversal', type: 'reversal', amount: '5.00', reversalOfEntryId: 'cash-payment' };
const openSession = { id: 'open-session', propertyId: actor.propertyId, status: 'open' };

function commandSetup(selections: unknown[][], returnedEntries: unknown[]) {
  const setup = service(); const inserted: unknown[] = [];
  setup.tx.select.mockImplementation(() => chain(selections.shift() ?? []));
  setup.tx.insert.mockImplementation(() => ({ values: vi.fn((value) => { inserted.push(value); const entry = returnedEntries.shift(); return entry ? { returning: vi.fn().mockResolvedValue([entry]) } : Promise.resolve(); }) }));
  return { ...setup, inserted };
}

function chain(value: unknown) {
  const query: any = {};
  for (const method of ['from', 'where', 'limit', 'for', 'orderBy']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: unknown) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(value).then(resolve, reject);
  return query;
}
