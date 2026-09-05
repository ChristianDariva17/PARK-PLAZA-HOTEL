import { Injectable, Inject, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE } from '../database/database.module.js';
import * as schema from '../database/schema/index.js';
import { AuditService } from '../audit/audit.service.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';

@Injectable()
export class EventsIdentityMigrationService {
  constructor(
    @Inject(DATABASE) private db: NodePgDatabase<typeof schema>,
    private auditService: AuditService,
  ) {}

  async getQuarantineInventory(propertyId: string) {
    const rows = await this.db.select({
      legacyPartyType: schema.events.legacyPartyType,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.events)
    .where(and(eq(schema.events.propertyId, propertyId), eq(schema.events.quarantineStatus, 'pending')))
    .groupBy(schema.events.legacyPartyType);

    const result = { guest: 0, customerAccount: 0, both: 0, neither: 0, total: 0 };
    for (const row of rows) {
      if (row.legacyPartyType) {
        result[row.legacyPartyType] += row.count;
        result.total += row.count;
      }
    }
    return result;
  }

  async resolveIdentity(
    actor: { accountId: string; propertyId: string },
    eventId: string,
    resolutionType: 'guest' | 'customerAccount',
    selectedId: string
  ) {
    if (resolutionType !== 'guest' && resolutionType !== 'customerAccount') {
      throw new BadRequestException('La resolución debe asignar un guest o un customerAccount explícitamente.');
    }
    if (!selectedId) {
      throw new BadRequestException('Se requiere un ID válido para la resolución.');
    }

    return await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, actor.propertyId);

      const rows = await tx.select({
        id: schema.events.id,
        quarantineStatus: schema.events.quarantineStatus,
      }).from(schema.events)
        .where(and(eq(schema.events.id, eventId), eq(schema.events.propertyId, actor.propertyId)))
        .limit(1).for('update');

      const current = rows[0];
      if (!current) throw new NotFoundException('Event not found');
      if (current.quarantineStatus === 'resolved') throw new ConflictException('Event identity is already resolved');

      const now = new Date();
      await tx.update(schema.events).set({
        quarantineStatus: 'resolved',
        quarantineResolvedAt: now,
        quarantineResolvedByAccountId: actor.accountId,
        guestId: resolutionType === 'guest' ? selectedId : null,
        customerAccountId: resolutionType === 'customerAccount' ? selectedId : null,
      }).where(eq(schema.events.id, eventId));

      await this.auditService.record({
        actorAccountId: actor.accountId,
        propertyId: actor.propertyId,
        eventType: 'event.quarantine_resolved',
        subjectType: 'event',
        subjectId: eventId,
        metadata: { resolutionType, selectedId },
      }, tx as any);
    });
  }
}
