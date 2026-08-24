import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { cashMovements, cashSessions } from '../database/schema/index.js';
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

  async openSession(
    actor: AuthenticatedAccount,
    dto: OpenCashSessionDto,
    context: RequestContext,
  ): Promise<CashSessionResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

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
    context: RequestContext,
  ): Promise<CashSessionResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

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

      const updated = await tx
        .update(cashSessions)
        .set({
          countedAmount: dto.countedAmount,
          expectedAmount: expectedAmount.toFixed(2),
          difference: (Number(dto.countedAmount) - expectedAmount).toFixed(2),
          notes: dto.note ? `${session.notes ?? ''} [Arqueo: ${dto.note}]`.trim() : session.notes,
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
    context: RequestContext,
  ): Promise<CashSessionResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

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

      const updated = await tx
        .update(cashSessions)
        .set({
          status: 'closed',
          closedAt: new Date(),
          countedAmount: dto.countedAmount,
          expectedAmount: expectedAmount.toFixed(2),
          difference: difference.toFixed(2),
          notes: dto.note ? `${session.notes ?? ''} [Cierre: ${dto.note}]`.trim() : session.notes,
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
    context: RequestContext,
  ): Promise<CashMovementResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

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
