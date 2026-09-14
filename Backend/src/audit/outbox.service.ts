import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit, Optional } from '@nestjs/common';
import { and, eq, lte, or } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { outboxEvents } from '../database/schema/index.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

export interface OutboxExecutor {
  insert(table: typeof outboxEvents): {
    values(value: unknown): PromiseLike<unknown>;
  };
}

export interface OutboxMessage {
  propertyId?: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxService.name);
  private timer?: NodeJS.Timeout;
  private dispatching = false;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.dispatchPending().catch((error: unknown) => {
        this.logger.error('Outbox dispatch cycle failed', error);
      });
    }, 5_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(executor: OutboxExecutor, message: OutboxMessage): Promise<void> {
    await executor.insert(outboxEvents).values({
      ...(message.propertyId ? { propertyId: message.propertyId } : {}),
      eventType: message.eventType,
      ...(message.aggregateType ? { aggregateType: message.aggregateType } : {}),
      ...(message.aggregateId ? { aggregateId: message.aggregateId } : {}),
      payload: message.payload,
    });
  }

  async dispatchPending(limit = 50): Promise<number> {
    if (this.dispatching) return 0;
    this.dispatching = true;

    try {
      const locked = await this.database.transaction(async (tx: any) => {
        const staleAt = new Date(Date.now() - 60_000);
        const rows = await tx
          .select()
          .from(outboxEvents)
          .where(or(
            and(eq(outboxEvents.status, 'pending'), lte(outboxEvents.availableAt, new Date())),
            and(eq(outboxEvents.status, 'processing'), lte(outboxEvents.lockedAt, staleAt)),
          ))
          .orderBy(outboxEvents.createdAt)
          .limit(limit)
          .for('update', { skipLocked: true });

        for (const row of rows) {
          await tx.update(outboxEvents).set({
            status: 'processing',
            attempts: row.attempts + 1,
            lockedAt: new Date(),
            lastError: null,
          }).where(eq(outboxEvents.id, row.id));
        }
        return rows;
      });

      for (const row of locked) {
        try {
          if (!this.realtime) throw new Error('Realtime gateway is unavailable');
          if (row.propertyId) {
            this.realtime.emitToProperty(row.propertyId, row.eventType, row.payload);
          } else {
            this.realtime.emitToAll(row.eventType, row.payload);
          }
          await this.database.update(outboxEvents).set({
            status: 'sent',
            processedAt: new Date(),
            lockedAt: null,
          }).where(eq(outboxEvents.id, row.id));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown outbox error';
          const retryAt = new Date(Date.now() + Math.min(300_000, 1_000 * 2 ** Math.min(row.attempts, 8)));
          await this.database.update(outboxEvents).set({
            status: 'pending',
            availableAt: retryAt,
            lockedAt: null,
            lastError: message.slice(0, 1_000),
          }).where(eq(outboxEvents.id, row.id));
          this.logger.warn(`Outbox event ${row.id} scheduled for retry: ${message}`);
        }
      }

      return locked.length;
    } finally {
      this.dispatching = false;
    }
  }
}
