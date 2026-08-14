import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type Database } from '../database/database.module.js';
import { auditEvents } from '../database/schema/index.js';
import type { RequestContext } from '../auth/auth.types.js';

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
  constructor(@Inject(DATABASE) private readonly database: Database) {}
  async record(event: AuditEventInput): Promise<void> {
    await this.database.insert(auditEvents).values({
      eventType: event.eventType,
      metadata: this.sanitize(event.metadata ?? {}),
      ...(event.requestId ? { requestId: event.requestId } : {}),
      ...(event.actorAccountId ? { actorAccountId: event.actorAccountId } : {}),
      ...(event.subjectType ? { subjectType: event.subjectType } : {}),
      ...(event.subjectId ? { subjectId: event.subjectId } : {}),
      ...(event.propertyId ? { propertyId: event.propertyId } : {}),
      ...(event.ipAddress ? { ipAddress: event.ipAddress } : {}),
      ...(event.userAgent ? { userAgent: event.userAgent } : {}),
    });
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
