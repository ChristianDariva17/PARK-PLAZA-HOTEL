import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../database/database.module.js';
import { auditEvents } from '../database/schema/index.js';
import type { RequestContext } from '../auth/auth.types.js';

type AuditEventRow = typeof auditEvents.$inferInsert;

interface AuditInsert {
  values(value: AuditEventRow): PromiseLike<unknown>;
  values(values: AuditEventRow[]): PromiseLike<unknown>;
}

export interface AuditExecutor {
  insert(table: typeof auditEvents): AuditInsert;
}

export interface AuditEventInput extends RequestContext {
  eventType: string;
  actorAccountId?: string;
  subjectType?: string;
  subjectId?: string;
  propertyId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly database: AuditExecutor) {}

  async record(event: AuditEventInput, executor: AuditExecutor = this.database): Promise<void> {
    await executor.insert(auditEvents).values(this.buildEvent(event));
  }

  async recordMany(events: readonly AuditEventInput[], executor: AuditExecutor = this.database): Promise<void> {
    if (events.length === 0) return;
    await executor.insert(auditEvents).values(events.map((event) => this.buildEvent(event)));
  }

  private buildEvent(event: AuditEventInput): AuditEventRow {
    return {
      eventType: event.eventType,
      metadata: this.sanitize(event.metadata ?? {}),
      ...(event.requestId ? { requestId: event.requestId } : {}),
      ...(event.actorAccountId ? { actorAccountId: event.actorAccountId } : {}),
      ...(event.subjectType ? { subjectType: event.subjectType } : {}),
      ...(event.subjectId ? { subjectId: event.subjectId } : {}),
      ...(event.propertyId ? { propertyId: event.propertyId } : {}),
      ...(event.ipAddress ? { ipAddress: event.ipAddress } : {}),
      ...(event.userAgent ? { userAgent: event.userAgent } : {}),
    };
  }

  private sanitize(value: Record<string, unknown>): Record<string, unknown> {
    const sensitive = /(password|token|secret|authorization|cookie)/i;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, this.sanitizeValue(item, sensitive)]));
  }

  private sanitizeValue(value: unknown, sensitive: RegExp): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item, sensitive));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, this.sanitizeValue(item, sensitive)]));
    return value;
  }
}
