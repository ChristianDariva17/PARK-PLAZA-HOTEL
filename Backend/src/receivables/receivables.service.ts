import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import { cashMovements, cashSessions, folioEntries, folios, guests, properties, receivableCommands, receivables, reservations, stays } from '../database/schema/index.js';
import { FolioService } from '../folios/folio.service.js';
import type { ReceivableCollectionDto, ReceivableReversalDto } from './receivables.dto.js';

const cents = (value: string) => BigInt(value.replace('.', ''));
const money = (value: bigint) => `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
const localDate = (date: Date, timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
const ageFor = (openedAt: Date, timezone: string) => Math.max(0, Math.floor((Date.parse(localDate(new Date(), timezone)) - Date.parse(localDate(openedAt, timezone))) / 86400000));
const ageMatches = (age: number, filter?: string) => !filter || (filter === '0_30' && age <= 30) || (filter === '31_60' && age >= 31 && age <= 60) || (filter === '61_90' && age >= 61 && age <= 90) || (filter === '91_plus' && age >= 91);

@Injectable()
export class ReceivablesService {
  constructor(@Inject(DATABASE) private readonly database: Database, private readonly audit: AuditService, private readonly foliosService: FolioService) {}

  async list(propertyId: string, filters: { status?: 'open' | 'settled'; age?: '0_30' | '31_60' | '61_90' | '91_plus' }) {
    const [property] = await this.database.select({ timezone: properties.timezone }).from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!property) throw new NotFoundException('Property not found');
    const rows = await this.database.select({ receivable: receivables, guest: guests, reservation: reservations }).from(receivables).innerJoin(guests, and(eq(guests.id, receivables.primaryGuestId), eq(guests.propertyId, receivables.propertyId))).innerJoin(reservations, and(eq(reservations.id, receivables.reservationId), eq(reservations.propertyId, receivables.propertyId))).where(and(eq(receivables.propertyId, propertyId), ...(filters.status ? [eq(receivables.status, filters.status)] : []))).orderBy(asc(receivables.openedAt));
    return rows.filter(({ receivable }) => ageMatches(ageFor(receivable.openedAt, property.timezone), filters.age)).map(({ receivable, guest, reservation }) => this.summary(receivable, guest, reservation, property.timezone));
  }

  async detail(propertyId: string, receivableId: string) {
    const [row] = await this.database.select({ receivable: receivables, guest: guests, reservation: reservations, stay: stays, folio: folios }).from(receivables).innerJoin(guests, and(eq(guests.id, receivables.primaryGuestId), eq(guests.propertyId, receivables.propertyId))).innerJoin(reservations, and(eq(reservations.id, receivables.reservationId), eq(reservations.propertyId, receivables.propertyId))).innerJoin(stays, and(eq(stays.id, receivables.stayId), eq(stays.propertyId, receivables.propertyId))).innerJoin(folios, and(eq(folios.id, receivables.folioId), eq(folios.propertyId, receivables.propertyId))).where(and(eq(receivables.id, receivableId), eq(receivables.propertyId, propertyId))).limit(1);
    if (!row) throw new NotFoundException('Receivable not found');
    const entries = await this.database.select().from(folioEntries).where(and(eq(folioEntries.propertyId, propertyId), eq(folioEntries.folioId, row.receivable.folioId))).orderBy(asc(folioEntries.createdAt));
    const collectionIds = new Set(entries.filter((entry) => entry.sourceType === 'receivable_collection').map((entry) => entry.id));
    return { ...this.summary(row.receivable, row.guest, row.reservation, 'UTC'), stay: { id: row.stay.id, status: row.stay.status }, folio: { id: row.folio.id }, history: entries.filter((entry) => entry.sourceType === 'receivable_collection' || (entry.reversalOfEntryId && collectionIds.has(entry.reversalOfEntryId))).map(this.entry) };
  }

  async collect(actor: AuthenticatedAccount, id: string, dto: ReceivableCollectionDto, key: string, context: RequestContext) {
    return this.command(actor, 'collection', key, context, async (tx) => {
      const receivable = await this.lockReceivable(tx, actor.propertyId, id);
      await this.assertEligible(tx, actor.propertyId, receivable);
      if (cents(dto.amount) > cents(receivable.outstandingAmount)) throw new ConflictException('Collection exceeds the outstanding balance');
      const cash = dto.method === 'Efectivo' ? await this.lockOwnedCashSession(tx, actor) : null;
      const entry = await this.foliosService.appendLockedReceivableEntry(tx, actor, { folioId: receivable.folioId, stayId: receivable.stayId, type: 'payment', amount: dto.amount, paymentMethod: dto.method, sourceType: 'receivable_collection', sourceId: key, idempotencyKey: key, ...(dto.reference === undefined ? {} : { reason: dto.reference }) }, context);
      const balance = cents(receivable.outstandingAmount) - cents(dto.amount); const outstandingAmount = money(balance); const now = new Date();
      const [updated] = await tx.update(receivables).set({ outstandingAmount, status: balance === 0n ? 'settled' : 'open', settledAt: balance === 0n ? now : null, updatedAt: now }).where(eq(receivables.id, receivable.id)).returning();
      if (cash) await tx.insert(cashMovements).values({ propertyId: actor.propertyId, sessionId: cash.id, type: 'Ingreso', concept: 'Cobranza de cuenta por cobrar', referenceId: entry.id, amount: dto.amount, method: 'Efectivo', responsible: actor.email });
      await this.audit.record({ ...this.auditBase(actor, context), eventType: 'receivable.collection_approved', subjectType: 'receivable', subjectId: receivable.id, metadata: { entryId: entry.id, folioId: receivable.folioId, amount: dto.amount, method: dto.method, reference: dto.reference ?? null } }, tx);
      return { receivable: this.projection(updated!), entry: this.entry(entry) };
    });
  }

  async reverse(actor: AuthenticatedAccount, id: string, entryId: string, dto: ReceivableReversalDto, key: string, context: RequestContext) {
    return this.command(actor, 'reversal', key, context, async (tx) => {
      const receivable = await this.lockReceivable(tx, actor.propertyId, id);
      if (receivable.status !== 'settled') throw new ConflictException('Only a settled receivable can be reversed');
      const [original] = await tx.select().from(folioEntries).where(and(eq(folioEntries.id, entryId), eq(folioEntries.propertyId, actor.propertyId), eq(folioEntries.folioId, receivable.folioId), eq(folioEntries.stayId, receivable.stayId), eq(folioEntries.sourceType, 'receivable_collection'))).limit(1).for('update', { of: folioEntries });
      if (!original) throw new NotFoundException('Receivable collection entry not found');
      const prior = await tx.select({ id: folioEntries.id }).from(folioEntries).where(eq(folioEntries.reversalOfEntryId, original.id)).limit(1);
      if (prior[0]) throw new ConflictException('Receivable collection is already reversed');
      if (cents(receivable.outstandingAmount) + cents(original.amount) > cents(receivable.originalAmount)) throw new ConflictException('Reversal exceeds original receivable balance');
      const cash = original.paymentMethod === 'Efectivo' ? await this.lockOwnedCashSession(tx, actor) : null;
      const entry = await this.foliosService.appendLockedReceivableEntry(tx, actor, { folioId: receivable.folioId, stayId: receivable.stayId, type: 'reversal', amount: original.amount, sourceType: 'receivable_reversal', sourceId: original.id, idempotencyKey: key, reversalOfEntryId: original.id, reason: dto.reason }, context);
      const outstandingAmount = money(cents(receivable.outstandingAmount) + cents(original.amount));
      const [updated] = await tx.update(receivables).set({ outstandingAmount, status: 'open', settledAt: null, updatedAt: new Date() }).where(eq(receivables.id, receivable.id)).returning();
      if (cash) await tx.insert(cashMovements).values({ propertyId: actor.propertyId, sessionId: cash.id, type: 'Egreso', concept: 'Reversión de cobranza', referenceId: entry.id, amount: original.amount, method: 'Efectivo', responsible: actor.email });
      await this.audit.record({ ...this.auditBase(actor, context), eventType: 'receivable.reversal_approved', subjectType: 'receivable', subjectId: receivable.id, metadata: { entryId: entry.id, reversalOfEntryId: original.id, folioId: receivable.folioId, reason: dto.reason } }, tx);
      return { receivable: this.projection(updated!), entry: this.entry(entry) };
    });
  }

  private async command(actor: AuthenticatedAccount, operation: string, key: string, context: RequestContext, run: (tx: any) => Promise<Record<string, unknown>>) {
    try {
      return await this.database.transaction(async (tx) => { await acquirePropertyTransactionLock(tx, actor.propertyId); const [receipt] = await tx.select({ response: receivableCommands.response }).from(receivableCommands).where(and(eq(receivableCommands.propertyId, actor.propertyId), eq(receivableCommands.operation, operation), eq(receivableCommands.idempotencyKey, key))).limit(1); if (receipt) return receipt.response; const response = await run(tx); await tx.insert(receivableCommands).values({ propertyId: actor.propertyId, operation, idempotencyKey: key, response }); return response; });
    } catch (error) {
      await this.audit.record({ ...this.auditBase(actor, context), eventType: `receivable.${operation}_rejected`, subjectType: 'receivable_command', metadata: { outcome: 'rejected' } });
      throw error;
    }
  }
  private async lockReceivable(tx: any, propertyId: string, id: string) { const [row] = await tx.select().from(receivables).where(and(eq(receivables.id, id), eq(receivables.propertyId, propertyId))).limit(1).for('update', { of: receivables }); if (!row) throw new NotFoundException('Receivable not found'); return row; }
  private async assertEligible(tx: any, propertyId: string, receivable: any) { if (receivable.status !== 'open') throw new ConflictException('Receivable is not open'); const [stay] = await tx.select().from(stays).where(and(eq(stays.id, receivable.stayId), eq(stays.propertyId, propertyId))).limit(1).for('update', { of: stays }); if (!stay || stay.status !== 'checked_out' || stay.settlement !== 'receivable') throw new ConflictException('Receivable stay is not eligible'); }
  private async lockOwnedCashSession(tx: any, actor: AuthenticatedAccount) { const [session] = await tx.select().from(cashSessions).where(and(eq(cashSessions.propertyId, actor.propertyId), eq(cashSessions.status, 'open'), eq(cashSessions.openedByAccountId, actor.accountId))).limit(1).for('update', { of: cashSessions }); if (!session) throw new ConflictException('An actor-owned open cash session is required for Efectivo'); return session; }
  private summary(receivable: any, guest: any, reservation: any, timezone: string) { return { ...this.projection(receivable), ageDays: ageFor(receivable.openedAt, timezone), guest: { id: guest.id, name: `${guest.firstName} ${guest.lastName}`, status: guest.status }, reservation: { id: reservation.id }, stayId: receivable.stayId, folioId: receivable.folioId }; }
  private projection(row: any) { return { id: row.id, status: row.status, originalAmount: row.originalAmount, outstandingAmount: row.outstandingAmount, reason: row.reason, openedAt: row.openedAt instanceof Date ? row.openedAt.toISOString() : row.openedAt, settledAt: row.settledAt instanceof Date ? row.settledAt.toISOString() : row.settledAt ?? null }; }
  private entry = (entry: any) => ({ id: entry.id, type: entry.type, amount: entry.amount, paymentMethod: entry.paymentMethod ?? null, reason: entry.reason ?? null, reversalOfEntryId: entry.reversalOfEntryId ?? null, createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt });
  private auditBase(actor: AuthenticatedAccount, context: RequestContext) { return { actorAccountId: actor.accountId, propertyId: actor.propertyId, ...(context.requestId ? { requestId: context.requestId } : {}), ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}), ...(context.userAgent ? { userAgent: context.userAgent } : {}) }; }
}
