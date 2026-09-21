import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, lte, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE, type Database } from '../database/database.module.js';
import { outboxEvents } from '../database/schema/index.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { MetricsService } from '../observability/metrics.service.js';
import type { Environment } from '../config/environment.js';
import { classifyOutboxError, retryDelayMs } from './outbox-domain.js';

export const OUTBOX_STATUSES = ['pending', 'processing', 'sent', 'dead_letter'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export function isOutboxStatus(value: string): value is OutboxStatus {
  return (OUTBOX_STATUSES as readonly string[]).includes(value);
}

export interface OutboxEventView {
  id: string;
  propertyId: string | null;
  stayId: string | null;
  eventType: string;
  aggregateType: string | null;
  aggregateId: string | null;
  requestId: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
  errorCode: string | null;
  createdAt: Date;
}

export interface OutboxExecutor {
  insert(table: typeof outboxEvents): {
    values(value: unknown): PromiseLike<unknown>;
  };
}

export interface OutboxMutationExecutor extends OutboxExecutor {
  update(table: typeof outboxEvents): any;
}

export interface OutboxMessage {
  propertyId?: string;
  stayId?: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  requestId?: string;
  payload: Record<string, unknown>;
}

type OutboxRow = typeof outboxEvents.$inferSelect;
type ClaimedOutboxRow = OutboxRow & {
  status: 'processing';
  attempts: number;
  maxAttempts: number;
  lockedAt: Date;
  lockToken: string;
};

@Injectable()
export class OutboxService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxService.name);
  private timer?: NodeJS.Timeout;
  private dispatching = false;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Optional() private readonly realtime?: RealtimeGateway,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly config?: ConfigService<Environment, true>,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.dispatchPending(this.dispatchLimit()).catch((error: unknown) => {
        const failure = classifyOutboxError(error);
        this.logger.error(`Outbox dispatch cycle failed: ${failure.code}`);
      });
    }, 5_000);
    this.timer.unref();
    void this.refreshOutboxMetrics().catch(() => undefined);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(executor: OutboxExecutor, message: OutboxMessage): Promise<void> {
    if (message.stayId && !message.propertyId) {
      throw new Error('Stay-scoped outbox messages require a propertyId');
    }
    await executor.insert(outboxEvents).values({
      ...(message.propertyId ? { propertyId: message.propertyId } : {}),
      ...(message.stayId ? { stayId: message.stayId } : {}),
      eventType: message.eventType,
      ...(message.aggregateType ? { aggregateType: message.aggregateType } : {}),
      ...(message.aggregateId ? { aggregateId: message.aggregateId } : {}),
      ...(message.requestId ? { requestId: message.requestId } : {}),
      payload: message.payload,
    });
  }

  async listEvents(propertyId: string, status?: OutboxStatus, limit = 50, offset = 0): Promise<OutboxEventView[]> {
    const condition = status
      ? and(eq(outboxEvents.propertyId, propertyId), eq(outboxEvents.status, status))
      : eq(outboxEvents.propertyId, propertyId);
    const rows = await this.database.select().from(outboxEvents)
      .where(condition)
      .orderBy(desc(outboxEvents.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => this.toSafeView(row));
  }

  async getEvent(propertyId: string, eventId: string): Promise<OutboxEventView | null> {
    const [row] = await this.database.select().from(outboxEvents).where(and(
      eq(outboxEvents.id, eventId),
      eq(outboxEvents.propertyId, propertyId),
    )).limit(1);
    return row ? this.toSafeView(row) : null;
  }

  async requeueDeadLetter(executor: OutboxMutationExecutor, propertyId: string, eventId: string): Promise<OutboxEventView | null> {
    const rows = await executor.update(outboxEvents).set({
      status: 'pending',
      attempts: 0,
      availableAt: new Date(),
      lockedAt: null,
      lockToken: null,
      processedAt: null,
      failedAt: null,
      errorCode: null,
      lastError: null,
    }).where(and(
      eq(outboxEvents.id, eventId),
      eq(outboxEvents.propertyId, propertyId),
      eq(outboxEvents.status, 'dead_letter'),
    )).returning();
    const row = Array.isArray(rows) ? rows[0] as OutboxRow | undefined : undefined;
    return row ? this.toSafeView(row) : null;
  }

  async dispatchPending(limit = this.dispatchLimit()): Promise<number> {
    if (this.dispatching) return 0;
    this.dispatching = true;

    try {
      const { claimed, terminalized } = await this.database.transaction(async (tx: any) => {
        const now = new Date();
        const staleAt = new Date(now.getTime() - this.lockTimeoutMs());
        const rows = await tx
          .select()
          .from(outboxEvents)
          .where(or(
            and(eq(outboxEvents.status, 'pending'), lte(outboxEvents.availableAt, now)),
            and(eq(outboxEvents.status, 'processing'), lte(outboxEvents.lockedAt, staleAt)),
          ))
          .orderBy(outboxEvents.createdAt)
          .limit(limit)
          .for('update', { skipLocked: true });

        const claimedRows: ClaimedOutboxRow[] = [];
        let terminalizedRows = 0;
        for (const row of rows) {
          const maxAttempts = row.maxAttempts ?? this.maxAttempts();
          if (row.attempts >= maxAttempts) {
            await tx.update(outboxEvents).set({
              status: 'dead_letter',
              failedAt: now,
              lockedAt: null,
              lockToken: null,
              errorCode: 'MAX_ATTEMPTS_EXCEEDED',
              lastError: 'MAX_ATTEMPTS_EXCEEDED',
            }).where(eq(outboxEvents.id, row.id));
            terminalizedRows += 1;
            continue;
          }

          const lockToken = randomUUID();
          const lockedAt = new Date();
          await tx.update(outboxEvents).set({
            status: 'processing',
            attempts: row.attempts + 1,
            lockedAt,
            lockToken,
          }).where(eq(outboxEvents.id, row.id));
          claimedRows.push({ ...row, status: 'processing', attempts: row.attempts + 1, maxAttempts, lockedAt, lockToken });
        }
        return { claimed: claimedRows, terminalized: terminalizedRows };
      });

      for (let index = 0; index < terminalized; index += 1) this.metrics?.recordOutbox('dead_letter');

      for (const row of claimed) {
        try {
          if (!this.realtime) throw new Error('Realtime gateway is unavailable');
          if (row.stayId) {
            await Promise.resolve(this.realtime.emitToStay(row.stayId, row.eventType, row.payload));
          } else if (row.propertyId) {
            await Promise.resolve(this.realtime.emitToProperty(row.propertyId, row.eventType, row.payload));
          } else {
            await Promise.resolve(this.realtime.emitToAll(row.eventType, row.payload));
          }
          await this.database.update(outboxEvents).set({
            status: 'sent',
            processedAt: new Date(),
            lockedAt: null,
            lockToken: null,
            failedAt: null,
            errorCode: null,
            lastError: null,
          }).where(and(
            eq(outboxEvents.id, row.id),
            eq(outboxEvents.status, 'processing'),
            eq(outboxEvents.lockToken, row.lockToken),
          ));
          this.metrics?.recordOutbox('sent');
        } catch (error: unknown) {
          const failure = classifyOutboxError(error);
          const shouldRetry = failure.kind === 'transient' && row.attempts < row.maxAttempts;
          if (shouldRetry) {
            const retryAt = new Date(Date.now() + retryDelayMs(row.attempts, this.retryBaseMs(), this.retryMaxMs()));
            await this.database.update(outboxEvents).set({
              status: 'pending',
              availableAt: retryAt,
              lockedAt: null,
              lockToken: null,
              errorCode: failure.code,
              lastError: failure.code,
            }).where(and(
              eq(outboxEvents.id, row.id),
              eq(outboxEvents.status, 'processing'),
              eq(outboxEvents.lockToken, row.lockToken),
            ));
            this.logger.warn(`Outbox event ${row.id} scheduled for retry: ${failure.code}`);
            this.metrics?.recordOutbox('retry');
          } else {
            await this.database.update(outboxEvents).set({
              status: 'dead_letter',
              failedAt: new Date(),
              lockedAt: null,
              lockToken: null,
              errorCode: failure.code,
              lastError: failure.code,
            }).where(and(
              eq(outboxEvents.id, row.id),
              eq(outboxEvents.status, 'processing'),
              eq(outboxEvents.lockToken, row.lockToken),
            ));
            this.logger.warn(`Outbox event ${row.id} moved to dead letter: ${failure.code}`);
            this.metrics?.recordOutbox('dead_letter');
          }
        }
      }

      return claimed.length;
    } finally {
      this.dispatching = false;
      await this.refreshOutboxMetrics().catch(() => undefined);
    }
  }

  private toSafeView(row: OutboxRow): OutboxEventView {
    return {
      id: row.id,
      propertyId: row.propertyId,
      stayId: row.stayId,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      requestId: row.requestId,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      availableAt: row.availableAt,
      lockedAt: row.lockedAt,
      processedAt: row.processedAt,
      failedAt: row.failedAt,
      errorCode: row.errorCode,
      createdAt: row.createdAt,
    };
  }

  private maxAttempts(): number {
    return this.config?.get('OUTBOX_MAX_ATTEMPTS', { infer: true }) ?? 8;
  }

  private retryBaseMs(): number {
    return this.config?.get('OUTBOX_RETRY_BASE_MS', { infer: true }) ?? 1_000;
  }

  private retryMaxMs(): number {
    return this.config?.get('OUTBOX_RETRY_MAX_MS', { infer: true }) ?? 300_000;
  }

  private lockTimeoutMs(): number {
    return this.config?.get('OUTBOX_LOCK_TIMEOUT_MS', { infer: true }) ?? 60_000;
  }

  private dispatchLimit(): number {
    return this.config?.get('OUTBOX_DISPATCH_LIMIT', { infer: true }) ?? 50;
  }

  private async refreshOutboxMetrics(): Promise<void> {
    if (!this.metrics) return;
    const [snapshot] = await this.database.select({
      pending: sql<number>`count(*) filter (where ${outboxEvents.status} = 'pending')`,
      processing: sql<number>`count(*) filter (where ${outboxEvents.status} = 'processing')`,
      deadLetter: sql<number>`count(*) filter (where ${outboxEvents.status} = 'dead_letter')`,
      oldestCreatedAt: sql<Date | null>`min(${outboxEvents.createdAt}) filter (where ${outboxEvents.status} = 'pending')`,
    }).from(outboxEvents);
    const oldestTime = snapshot?.oldestCreatedAt ? new Date(snapshot.oldestCreatedAt).getTime() : Date.now();
    this.metrics.setOutboxBacklog(
      Number(snapshot?.pending ?? 0),
      Number(snapshot?.processing ?? 0),
      Number(snapshot?.deadLetter ?? 0),
      Math.max(0, (Date.now() - oldestTime) / 1_000),
    );
  }
}
