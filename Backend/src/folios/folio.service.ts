import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { cashMovements, cashSessions, folioEntries, folios, stays } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type { FolioChargeDto, FolioPaymentDto, FolioReversalDto } from './folio.dto.js';

const cents = (amount: string) => BigInt(amount.replace('.', ''));
const money = (amount: bigint) => `${amount / 100n}.${(amount < 0n ? -amount : amount) % 100n}`.replace(/\.(\d)$/, '.0$1');
const signed = (entry: { type: string; amount: string; reversalOfEntryId: string | null }, originals: Map<string, string>) => {
  const value = cents(entry.amount);
  if (entry.type === 'charge') return value;
  if (entry.type === 'payment') return -value;
  return originals.get(entry.reversalOfEntryId || '') === 'payment' ? value : -value;
};

@Injectable()
export class FolioService {
  constructor(@Inject(DATABASE) private readonly database: Database, private readonly audit: AuditService) {}

  async get(propertyId: string, stayId: string) { return this.read(this.database, propertyId, stayId); }

  async charge(actor: AuthenticatedAccount, stayId: string, dto: FolioChargeDto, key: string, context: RequestContext) {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      if (await this.findByIdempotencyKey(tx, actor.propertyId, key)) return this.read(tx, actor.propertyId, stayId);
      await this.insert(tx, actor, stayId, { type: 'charge', amount: dto.amount, sourceType: 'manual_charge', sourceId: key, idempotencyKey: key, reason: dto.description }, context);
      return this.read(tx, actor.propertyId, stayId);
    });
  }

  async payment(actor: AuthenticatedAccount, stayId: string, dto: FolioPaymentDto, key: string, context: RequestContext) {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      if (await this.findByIdempotencyKey(tx, actor.propertyId, key)) return this.read(tx, actor.propertyId, stayId);
      const current = await this.read(tx, actor.propertyId, stayId, true);
      if (cents(dto.amount) > cents(current.balance)) throw new ConflictException('Payment exceeds the outstanding balance');
      if (dto.method === 'Efectivo') await this.assertOpenCashSession(tx, actor.propertyId);
      const entry = await this.insert(tx, actor, stayId, { type: 'payment', amount: dto.amount, paymentMethod: dto.method, sourceType: 'manual_payment', sourceId: key, idempotencyKey: key }, context, current);
      if (dto.method === 'Efectivo') await this.cashMovement(tx, actor, entry, 'Ingreso');
      return this.read(tx, actor.propertyId, stayId);
    });
  }

  async reverse(actor: AuthenticatedAccount, stayId: string, entryId: string, dto: FolioReversalDto, key: string, context: RequestContext) {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      if (await this.findByIdempotencyKey(tx, actor.propertyId, key)) return this.read(tx, actor.propertyId, stayId);
      const original = (await tx.select().from(folioEntries).where(and(eq(folioEntries.id, entryId), eq(folioEntries.propertyId, actor.propertyId), eq(folioEntries.stayId, stayId))).limit(1).for('update', { of: folioEntries }))[0];
      if (!original || original.type === 'reversal') throw new NotFoundException('Folio entry not found');
      const exists = await tx.select({ id: folioEntries.id }).from(folioEntries).where(eq(folioEntries.reversalOfEntryId, original.id)).limit(1);
      if (exists[0]) throw new ConflictException('Folio entry is already reversed');
      if (original.type === 'payment' && original.paymentMethod === 'Efectivo') await this.assertOpenCashSession(tx, actor.propertyId);
      const entry = await this.insert(tx, actor, stayId, { type: 'reversal', amount: original.amount, sourceType: 'reversal', sourceId: original.id, idempotencyKey: key, reversalOfEntryId: original.id, reason: dto.reason }, context);
      if (original.type === 'payment' && original.paymentMethod === 'Efectivo') await this.cashMovement(tx, actor, entry, 'Egreso');
      return this.read(tx, actor.propertyId, stayId);
    });
  }

  async postRestaurantCharge(tx: any, actor: AuthenticatedAccount, stayId: string, orderId: string, amount: string, context: RequestContext) {
    return this.insert(tx, actor, stayId, { type: 'charge', amount, sourceType: 'restaurant_order', sourceId: orderId, idempotencyKey: orderId, reason: 'Restaurant order delivered' }, context);
  }
  async reverseRestaurantCharge(tx: any, actor: AuthenticatedAccount, stayId: string, orderId: string, reason: string, context: RequestContext) {
    const original = (await tx.select().from(folioEntries).where(and(eq(folioEntries.propertyId, actor.propertyId), eq(folioEntries.sourceType, 'restaurant_order'), eq(folioEntries.sourceId, orderId))).limit(1))[0];
    if (!original) throw new ConflictException('Restaurant folio charge is unavailable');
    const prior = (await tx.select().from(folioEntries).where(and(eq(folioEntries.propertyId, actor.propertyId), eq(folioEntries.sourceType, 'restaurant_cancellation'), eq(folioEntries.sourceId, orderId))).limit(1))[0];
    if (prior) return prior;
    return this.insert(tx, actor, stayId, { type: 'reversal', amount: original.amount, sourceType: 'restaurant_cancellation', sourceId: orderId, idempotencyKey: original.id, reversalOfEntryId: original.id, reason }, context);
  }

  async read(tx: any, propertyId: string, stayId: string, lock = false): Promise<any> {
    let query = tx.select().from(stays).where(and(eq(stays.id, stayId), eq(stays.propertyId, propertyId))).limit(1);
    if (lock) query = query.for('update', { of: stays });
    const stay = (await query)[0];
    if (!stay) throw new NotFoundException('Stay not found');
    const folio = (await tx.select().from(folios).where(and(eq(folios.stayId, stayId), eq(folios.propertyId, propertyId))).limit(1))[0];
    if (!folio) throw new ConflictException('Stay folio is unavailable');
    const entries = await tx.select().from(folioEntries).where(and(eq(folioEntries.stayId, stayId), eq(folioEntries.propertyId, propertyId))).orderBy(asc(folioEntries.createdAt));
    const types = new Map<string, string>(entries.map((entry: any) => [entry.id, entry.type]));
    const balance = entries.reduce((total: bigint, entry: any) => total + signed(entry, types), 0n);
    return { folio: { id: folio.id, stayId, openingBalance: '0.00' }, entries, balance: money(balance), settlement: stay.settlement, receivable: stay.receivableAmount ? { amount: stay.receivableAmount, reason: stay.receivableReason } : null };
  }

  private async insert(tx: any, actor: AuthenticatedAccount, stayId: string, input: any, context: RequestContext, current?: any) {
    const state = current || await this.read(tx, actor.propertyId, stayId, true);
    if (state.settlement !== 'open') throw new ConflictException('Folio is no longer open');
    const existing = await tx.select().from(folioEntries).where(and(eq(folioEntries.propertyId, actor.propertyId), eq(folioEntries.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing[0]) return existing[0];
    const [entry] = await tx.insert(folioEntries).values({ propertyId: actor.propertyId, folioId: state.folio.id, stayId, ...input, actorAccountId: actor.accountId }).returning();
    await this.audit.record({ actorAccountId: actor.accountId, propertyId: actor.propertyId, ...(context.requestId ? { requestId: context.requestId } : {}), eventType: `folio.${input.type}`, subjectType: 'folio_entry', subjectId: entry.id, metadata: { stayId, amount: input.amount, sourceType: input.sourceType, reason: input.reason ?? null } }, tx);
    return entry;
  }
  private async findByIdempotencyKey(tx: any, propertyId: string, key: string) {
    return (await tx.select({ id: folioEntries.id }).from(folioEntries).where(and(eq(folioEntries.propertyId, propertyId), eq(folioEntries.idempotencyKey, key))).limit(1))[0];
  }
  private async assertOpenCashSession(tx: any, propertyId: string) { const session = (await tx.select().from(cashSessions).where(and(eq(cashSessions.propertyId, propertyId), eq(cashSessions.status, 'open'))).limit(1).for('update', { of: cashSessions }))[0]; if (!session) throw new ConflictException('An open cash session is required for Efectivo'); return session; }
  private async cashMovement(tx: any, actor: AuthenticatedAccount, entry: any, type: 'Ingreso' | 'Egreso') { const session = await this.assertOpenCashSession(tx, actor.propertyId); await tx.insert(cashMovements).values({ propertyId: actor.propertyId, sessionId: session.id, type, concept: `Folio ${entry.type}`, referenceId: entry.id, amount: entry.amount, method: 'Efectivo', responsible: actor.email }); }
}
