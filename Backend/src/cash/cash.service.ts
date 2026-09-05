import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { cashCommands, cashCounts, cashMovements, cashSessions } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type {
  CloseCashSessionDto,
  CountCashSessionDto,
  CreateCashMovementDto,
  OpenCashSessionDto,
} from './cash.dto.js';

export interface CashSessionResponse {
  id: string;
  propertyId: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: string;
  countedAmount: string | null;
  expectedAmount: string | null;
  difference: string | null;
  responsible: string;
  shift: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashMovementResponse {
  id: string;
  sessionId: string;
  type: string;
  concept: string;
  referenceId: string | null;
  amount: string;
  method: string;
  createdAt: string;
  responsible: string;
}

export interface CashCountResponse {
  id: string;
  sessionId: string;
  countedAmount: string;
  expectedAmount: string;
  difference: string;
  note: string;
  countedBy: string;
  kind: string;
  createdAt: string;
}

@Injectable()
export class CashService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async getActiveSession(propertyId: string): Promise<CashSessionResponse | null> {
    const rows = await this.database
      .select()
      .from(cashSessions)
      .where(and(eq(cashSessions.propertyId, propertyId), eq(cashSessions.status, 'open')))
      .limit(1);
    return rows[0] ? this.formatSession(rows[0]) : null;
  }

  async listSessions(propertyId: string): Promise<CashSessionResponse[]> {
    const rows = await this.database
      .select()
      .from(cashSessions)
      .where(eq(cashSessions.propertyId, propertyId))
      .orderBy(cashSessions.openedAt);
    return rows.map((r) => this.formatSession(r));
  }

  async listMovements(propertyId: string, sessionId: string): Promise<CashMovementResponse[]> {
    const rows = await this.database
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.propertyId, propertyId), eq(cashMovements.sessionId, sessionId)))
      .orderBy(cashMovements.createdAt);
    return rows.map((r) => this.formatMovement(r));
  }

  async listCounts(propertyId: string, sessionId: string): Promise<CashCountResponse[]> {
    const rows = await this.database
      .select()
      .from(cashCounts)
      .where(and(eq(cashCounts.propertyId, propertyId), eq(cashCounts.sessionId, sessionId)))
      .orderBy(cashCounts.createdAt);
    return rows.map((row) => this.formatCount(row));
  }

  async openSession(
    actor: AuthenticatedAccount,
    dto: OpenCashSessionDto,
    key: string,
    context: RequestContext,
  ): Promise<CashSessionResponse> {
    return this.command(actor, 'open', key, async (tx) => {

      // Verify no session is currently open
      const active = await tx
        .select()
        .from(cashSessions)
        .where(and(eq(cashSessions.propertyId, actor.propertyId), eq(cashSessions.status, 'open')))
        .limit(1);

      if (active.length > 0) {
        throw new ConflictException('Ya existe un turno de caja abierto para esta propiedad');
      }

      const inserted = await tx
        .insert(cashSessions)
        .values({
          propertyId: actor.propertyId,
          openedByAccountId: actor.accountId,
          openingAmount: dto.openingAmount,
          responsible: dto.responsible,
          shift: dto.shift,
          status: 'open',
          notes: dto.notes ?? null,
        })
        .returning();

      const session = inserted[0]!;

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'cash.opened',
          subjectType: 'cash_session',
          subjectId: session.id,
          metadata: { openingAmount: dto.openingAmount, shift: dto.shift, responsible: dto.responsible },
        },
        tx,
      );

      return this.formatSession(session);
    });
  }

  async countSession(
    actor: AuthenticatedAccount,
    sessionId: string,
    dto: CountCashSessionDto,
    key: string,
    context: RequestContext,
  ): Promise<CashSessionResponse> {
    return this.command(actor, 'count', key, async (tx) => {

      const rows = await tx
        .select()
        .from(cashSessions)
        .where(and(eq(cashSessions.id, sessionId), eq(cashSessions.propertyId, actor.propertyId)))
        .limit(1)
        .for('update', { of: cashSessions });

      const session = rows[0];
      if (!session) throw new NotFoundException('Cash session not found');
      if (session.status !== 'open') throw new ConflictException('Cannot count a closed session');

      const expectedAmount = await this.calculateExpectedAmount(tx, actor.propertyId, session);
      const difference = (Number(dto.countedAmount) - expectedAmount).toFixed(2);

      await tx.insert(cashCounts).values({
        propertyId: actor.propertyId,
        sessionId: session.id,
        countedAmount: dto.countedAmount,
        expectedAmount: expectedAmount.toFixed(2),
        difference,
        note: dto.note ?? null,
        countedByAccountId: actor.accountId,
        countedBy: actor.email,
        kind: 'count',
      });

      const updated = await tx
        .update(cashSessions)
        .set({
          countedAmount: dto.countedAmount,
          expectedAmount: expectedAmount.toFixed(2),
          difference,
          updatedAt: new Date(),
        })
        .where(eq(cashSessions.id, session.id))
        .returning();

      const finalSession = updated[0]!;

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'cash.counted',
          subjectType: 'cash_session',
          subjectId: session.id,
          metadata: { countedAmount: dto.countedAmount, expectedAmount: finalSession.expectedAmount, difference: finalSession.difference },
        },
        tx,
      );

      return this.formatSession(finalSession);
    });
  }

  async closeSession(
    actor: AuthenticatedAccount,
    sessionId: string,
    dto: CloseCashSessionDto,
    key: string,
    context: RequestContext,
  ): Promise<CashSessionResponse> {
    return this.command(actor, 'close', key, async (tx) => {

      const rows = await tx
        .select()
        .from(cashSessions)
        .where(and(eq(cashSessions.id, sessionId), eq(cashSessions.propertyId, actor.propertyId)))
        .limit(1)
        .for('update', { of: cashSessions });

      const session = rows[0];
      if (!session) throw new NotFoundException('Cash session not found');
      if (session.status !== 'open') throw new ConflictException('Session is already closed');

      const expectedAmount = await this.calculateExpectedAmount(tx, actor.propertyId, session);
      const difference = Number(dto.countedAmount) - expectedAmount;

      await tx.insert(cashCounts).values({
        propertyId: actor.propertyId,
        sessionId: session.id,
        countedAmount: dto.countedAmount,
        expectedAmount: expectedAmount.toFixed(2),
        difference: difference.toFixed(2),
        note: dto.note ?? null,
        countedByAccountId: actor.accountId,
        countedBy: actor.email,
        kind: 'close',
      });

      const updated = await tx
        .update(cashSessions)
        .set({
          status: 'closed',
          closedAt: new Date(),
          countedAmount: dto.countedAmount,
          expectedAmount: expectedAmount.toFixed(2),
          difference: difference.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(cashSessions.id, session.id))
        .returning();

      const finalSession = updated[0]!;

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'cash.closed',
          subjectType: 'cash_session',
          subjectId: session.id,
          metadata: { countedAmount: dto.countedAmount, expectedAmount: finalSession.expectedAmount, difference: finalSession.difference },
        },
        tx,
      );

      return this.formatSession(finalSession);
    });
  }

  async createMovement(
    actor: AuthenticatedAccount,
    dto: CreateCashMovementDto,
    key: string,
    context: RequestContext,
  ): Promise<CashMovementResponse> {
    return this.command(actor, 'movement', key, async (tx) => {

      // Verify active open session
      const active = await tx
        .select()
        .from(cashSessions)
        .where(and(eq(cashSessions.propertyId, actor.propertyId), eq(cashSessions.status, 'open')))
        .limit(1);

      if (active.length === 0) {
        throw new ConflictException('No se pueden registrar movimientos sin un turno de caja abierto');
      }

      const session = active[0]!;

      const inserted = await tx
        .insert(cashMovements)
        .values({
          propertyId: actor.propertyId,
          sessionId: session.id,
          type: dto.type,
          concept: dto.concept,
          referenceId: dto.referenceId ?? null,
          amount: dto.amount,
          method: dto.method,
          responsible: actor.email, // using actor email/name as responsible
        })
        .returning();

      const movement = inserted[0]!;

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'cash.movement_created',
          subjectType: 'cash_movement',
          subjectId: movement.id,
          metadata: { type: dto.type, concept: dto.concept, amount: dto.amount, method: dto.method, sessionId: session.id },
        },
        tx,
      );

      return this.formatMovement(movement);
    });
  }

  private async calculateExpectedAmount(tx: any, propertyId: string, session: any): Promise<number> {
    const movements = await tx
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.propertyId, propertyId), eq(cashMovements.sessionId, session.id)));

    let current = Number(session.openingAmount);
    for (const mov of movements) {
      const amt = Number(mov.amount);
      if (mov.method !== 'Efectivo') continue;
      if (mov.type === 'Ingreso') {
        current += amt;
      } else {
        current -= amt;
      }
    }
    return current;
  }

  private formatSession(row: any): CashSessionResponse {
    return {
      id: row.id,
      propertyId: row.propertyId,
      openedAt: row.openedAt instanceof Date ? row.openedAt.toISOString() : row.openedAt,
      closedAt: row.closedAt instanceof Date ? row.closedAt.toISOString() : row.closedAt ?? null,
      openingAmount: row.openingAmount,
      countedAmount: row.countedAmount ?? null,
      expectedAmount: row.expectedAmount ?? null,
      difference: row.difference ?? null,
      responsible: row.responsible,
      shift: row.shift,
      status: row.status,
      notes: row.notes ?? '',
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  private formatMovement(row: any): CashMovementResponse {
    return {
      id: row.id,
      sessionId: row.sessionId,
      type: row.type,
      concept: row.concept,
      referenceId: row.referenceId ?? null,
      amount: row.amount,
      method: row.method,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      responsible: row.responsible,
    };
  }

  private formatCount(row: any): CashCountResponse {
    return {
      id: row.id,
      sessionId: row.sessionId,
      countedAmount: row.countedAmount,
      expectedAmount: row.expectedAmount,
      difference: row.difference,
      note: row.note ?? '',
      countedBy: row.countedBy,
      kind: row.kind,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
  }

  private async command<T extends object>(
    actor: AuthenticatedAccount,
    operation: string,
    key: string,
    run: (tx: any) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      const [receipt] = await tx
        .select({ response: cashCommands.response })
        .from(cashCommands)
        .where(and(
          eq(cashCommands.propertyId, actor.propertyId),
          eq(cashCommands.operation, operation),
          eq(cashCommands.idempotencyKey, key),
        ))
        .limit(1);
      if (receipt) return receipt.response as T;
      const response = await run(tx);
      await tx.insert(cashCommands).values({ propertyId: actor.propertyId, operation, idempotencyKey: key, response: response as Record<string, unknown> });
      return response;
    });
  }

  private auditBase(actor: AuthenticatedAccount, context: RequestContext) {
    return {
      actorAccountId: actor.accountId,
      propertyId: actor.propertyId,
      ...(context.requestId ? { requestId: context.requestId } : {}),
      ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
    };
  }
}
