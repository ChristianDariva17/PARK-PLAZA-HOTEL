import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE, Database } from '../database/database.module.js';
import { contracts, contractVersions, evidences, contractEvidenceLinks } from '../database/schema/documents.schema.js';
import { accounts, auditEvents, roles } from '../database/schema/security.schema.js';
import { eq, and, desc, inArray, count, gte, lte, ilike, or } from 'drizzle-orm';
import { ListAuditEventsQueryDto } from './documents.dto.js';

export interface RequestContext {
  requestId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

@Injectable()
export class DocumentsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createContract(propertyId: string, accountId: string, data: any, ctx: RequestContext) {
    const { reservationId, metadata, reason } = data;
    const idempotencyKey = data.idempotencyKey || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const reference = data.reference || `DOC-ESTADIA-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const initialStatus = data.status || (metadata?.signatures?.guestSignature ? 'Vigente' : 'Borrador');

    // Check idempotency
    const [existingVersion] = await this.db
      .select()
      .from(contractVersions)
      .where(and(eq(contractVersions.propertyId, propertyId), eq(contractVersions.idempotencyKey, idempotencyKey)));

    if (existingVersion) {
      return this.getContract(propertyId, existingVersion.contractId);
    }

    return await this.db.transaction(async (tx: any) => {
      // Create contract
      const [newContract] = await tx.insert(contracts).values({
        propertyId,
        reference,
        reservationId: reservationId || null,
        status: initialStatus,
      }).returning();

      // Create version 1
      const [newVersion] = await tx.insert(contractVersions).values({
        propertyId,
        contractId: newContract.id,
        versionNumber: '1',
        creatorAccountId: accountId,
        metadata: metadata || {},
        reason: reason || 'Registro de Condiciones de Estadía al Check-In',
        idempotencyKey,
      }).returning();

      // Log audit
      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'contract.created',
        subjectType: 'contract',
        subjectId: newContract.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reference, version: '1', status: initialStatus }
      });

      return { ...newContract, versions: [newVersion], metadata: newVersion.metadata };
    });
  }

  async getContract(propertyId: string, contractId: string) {
    const [contract] = await this.db
      .select()
      .from(contracts)
      .where(and(eq(contracts.propertyId, propertyId), eq(contracts.id, contractId)));

    if (!contract) throw new NotFoundException('Contrato no encontrado');

    const versions = await this.db
      .select()
      .from(contractVersions)
      .where(and(eq(contractVersions.propertyId, propertyId), eq(contractVersions.contractId, contractId)))
      .orderBy(desc(contractVersions.createdAt));

    const links = await this.db
      .select()
      .from(contractEvidenceLinks)
      .where(and(eq(contractEvidenceLinks.propertyId, propertyId), eq(contractEvidenceLinks.contractId, contractId)));

    const latestVersion = versions[0];

    return {
      ...contract,
      versions,
      metadata: latestVersion?.metadata || {},
      version: latestVersion?.versionNumber || '1',
      generatedAt: contract.createdAt,
      evidenceLinks: links
    };
  }

  async listContracts(propertyId: string, page: number, limit: number, status?: string, reference?: string) {
    const offset = (page - 1) * limit;
    
    const conditions = [eq(contracts.propertyId, propertyId)];
    if (status) conditions.push(eq(contracts.status, status as any));
    if (reference) conditions.push(eq(contracts.reference, reference));

    const contractList = await this.db
      .select()
      .from(contracts)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(contracts.createdAt));

    if (!contractList.length) return [];

    const contractIds = contractList.map((c) => c.id);
    const versions = await this.db
      .select()
      .from(contractVersions)
      .where(and(eq(contractVersions.propertyId, propertyId), inArray(contractVersions.contractId, contractIds)))
      .orderBy(desc(contractVersions.createdAt));

    return contractList.map((contract) => {
      const contractVers = versions.filter((v) => v.contractId === contract.id);
      const latestVersion = contractVers[0];
      return {
        ...contract,
        version: latestVersion?.versionNumber || '1',
        metadata: latestVersion?.metadata || {},
        generatedAt: contract.createdAt,
        versions: contractVers,
      };
    });
  }

  async transitionContract(propertyId: string, accountId: string, contractId: string, data: any, ctx: RequestContext) {
    const { status, idempotencyKey, reason } = data;

    const [contract] = await this.db
      .select()
      .from(contracts)
      .where(and(eq(contracts.propertyId, propertyId), eq(contracts.id, contractId)));

    if (!contract) throw new NotFoundException('Contrato no encontrado');
    
    if (contract.status === status) return this.getContract(propertyId, contractId);

    return await this.db.transaction(async (tx: any) => {
      const [updated] = await tx.update(contracts)
        .set({ status, updatedAt: new Date() })
        .where(eq(contracts.id, contractId))
        .returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'contract.transitioned',
        subjectType: 'contract',
        subjectId: contractId,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { from: contract.status, to: status, reason, idempotencyKey }
      });

      return updated;
    });
  }

  async registerEvidence(propertyId: string, accountId: string, data: any, ctx: RequestContext) {
    const { sourceType, referenceId, evidenceType, description, url, metadata, idempotencyKey } = data;
    const evidenceMetadata = {
      ...(metadata || {}),
      evidenceType,
      ...(url ? { url } : {}),
    };
    
    return await this.db.transaction(async (tx: any) => {
      const [evidence] = await tx.insert(evidences).values({
        propertyId,
        originType: String(sourceType).toLowerCase(),
        originId: referenceId,
        description: description || evidenceType,
        metadata: evidenceMetadata,
        creatorAccountId: accountId,
      }).returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'evidence.registered',
        subjectType: 'evidence',
        subjectId: evidence.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { originType: String(sourceType).toLowerCase(), originId: referenceId, idempotencyKey }
      });

      return evidence;
    });
  }

  async listEvidences(propertyId: string, page: number, limit: number, source?: string, referenceId?: string) {
    const offset = (page - 1) * limit;
    const conditions = [eq(evidences.propertyId, propertyId)];
    if (source) conditions.push(eq(evidences.originType, source.toLowerCase()));
    if (referenceId) conditions.push(eq(evidences.originId, referenceId));
    const results = await this.db
      .select()
      .from(evidences)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(evidences.createdAt));
    return results;
  }

  async linkEvidence(propertyId: string, accountId: string, contractId: string, data: any, ctx: RequestContext) {
    const { evidenceId, relationType, idempotencyKey } = data;

    const [existingLink] = await this.db
      .select()
      .from(contractEvidenceLinks)
      .where(and(eq(contractEvidenceLinks.contractId, contractId), eq(contractEvidenceLinks.evidenceId, evidenceId)));

    if (existingLink) return existingLink;

    return await this.db.transaction(async (tx: any) => {
      const [link] = await tx.insert(contractEvidenceLinks).values({
        propertyId,
        contractId,
        evidenceId,
        relationType,
        linkedByAccountId: accountId,
      }).returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'contract.evidence_linked',
        subjectType: 'contract',
        subjectId: contractId,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { evidenceId, relationType, idempotencyKey }
      });

      return link;
    });
  }

  async listAuditEvents(propertyId: string, page: number, limit: number, query: ListAuditEventsQueryDto = {}) {
    const offset = (page - 1) * limit;

    const conditions = [eq(auditEvents.propertyId, propertyId)];
    if (query.eventType) conditions.push(eq(auditEvents.eventType, query.eventType));
    if (query.subjectType) conditions.push(eq(auditEvents.subjectType, query.subjectType));
    if (query.subjectId) conditions.push(eq(auditEvents.subjectId, query.subjectId));
    if (query.actorAccountId) conditions.push(eq(auditEvents.actorAccountId, query.actorAccountId));
    if (query.from) conditions.push(gte(auditEvents.occurredAt, new Date(query.from)));
    if (query.to) conditions.push(lte(auditEvents.occurredAt, new Date(query.to)));
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(or(
        ilike(auditEvents.eventType, pattern),
        ilike(auditEvents.subjectType, pattern),
        ilike(auditEvents.subjectId, pattern),
        ilike(accounts.email, pattern),
      )!);
    }

    const where = and(...conditions);
    const [results, totalResult] = await Promise.all([
      this.db
        .select({
          id: auditEvents.id,
          occurredAt: auditEvents.occurredAt,
          eventType: auditEvents.eventType,
          requestId: auditEvents.requestId,
          actorAccountId: auditEvents.actorAccountId,
          actorEmail: accounts.email,
          actorRole: roles.key,
          subjectType: auditEvents.subjectType,
          subjectId: auditEvents.subjectId,
          propertyId: auditEvents.propertyId,
          ipAddress: auditEvents.ipAddress,
          userAgent: auditEvents.userAgent,
          metadata: auditEvents.metadata,
        })
      .from(auditEvents)
      .leftJoin(accounts, and(eq(auditEvents.actorAccountId, accounts.id), eq(accounts.propertyId, propertyId)))
      .leftJoin(roles, eq(accounts.roleId, roles.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(auditEvents.occurredAt)),
      this.db
        .select({ count: count() })
        .from(auditEvents)
        .leftJoin(accounts, and(eq(auditEvents.actorAccountId, accounts.id), eq(accounts.propertyId, propertyId)))
        .where(where),
    ]);

    return { items: results.map((event) => ({
      ...event,
      actor: event.actorAccountId ? {
        id: event.actorAccountId,
        email: event.actorEmail,
        role: event.actorRole,
      } : null,
    })), total: Number(totalResult[0]?.count ?? 0) };
  }
}
