import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { properties } from '../database/schema/hotel.schema.js';
import { AuditService } from '../audit/audit.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { AuthenticatedAccount } from '../auth/auth.types.js';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private readonly audit: AuditService,
  ) {}

  async getSettings(propertyId: string) {
    const records = await this.db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!records.length) throw new NotFoundException('Property settings not found');
    return records[0];
  }

  async updateSettings(actor: AuthenticatedAccount, data: Partial<typeof properties.$inferInsert>, context: RequestContext) {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No valid fields provided for update');
    }
    
    return this.db.transaction(async (tx) => {
      const updated = await tx.update(properties).set(data).where(eq(properties.id, actor.propertyId)).returning();
      if (!updated.length) throw new NotFoundException('Property settings not found');
      
      await this.audit.record({
        eventType: 'settings.updated',
        propertyId: actor.propertyId,
        actorAccountId: actor.accountId,
        subjectType: 'property_settings',
        subjectId: actor.propertyId,
        metadata: { updatedFields: Object.keys(data), newValues: data },
        ...(context.requestId ? { requestId: context.requestId } : {}),
        ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
        ...(context.userAgent ? { userAgent: context.userAgent } : {}),
      }, tx as any);
      
      return updated[0];
    });
  }
}
