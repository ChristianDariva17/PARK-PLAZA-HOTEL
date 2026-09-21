import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DATABASE, Database } from '../database/database.module.js';
import { contracts, contractVersions, evidences, contractEvidenceLinks } from '../database/schema/documents.schema.js';
import { accounts, auditEvents, roles } from '../database/schema/security.schema.js';
import { cleaningTasks } from '../database/schema/cleaning.schema.js';
import { incidents } from '../database/schema/incidents.schema.js';
import { reservations } from '../database/schema/reservations.schema.js';
import { eq, and, desc, inArray, count, gte, lte, ilike, or } from 'drizzle-orm';
import { CONTRACT_TARGET_STATES, ListAuditEventsQueryDto } from './documents.dto.js';
import { commandReceipts } from '../database/schema/commands.schema.js';
import { requestFingerprint } from '../database/idempotency.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';

const contractTargetStateToStatus = {
  DRAFT: 'Borrador',
  PENDING_SIGNATURE: 'Pendiente',
  SIGNED: 'Vigente',
  ARCHIVED: 'Reemplazado',
  VOID: 'Cancelado',
} as const;

const allowedContractTransitions: Record<string, readonly string[]> = {
  Borrador: ['Pendiente', 'Vigente', 'Cancelado'],
  Pendiente: ['Borrador', 'Vigente', 'Cancelado'],
  Vigente: ['Reemplazado', 'Cancelado'],
  Reemplazado: [],
  Cancelado: [],
};

export interface RequestContext {
  requestId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

@Injectable()
export class DocumentsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createContract(propertyId: string, accountId: string, data: any, idempotencyKey: string, ctx: RequestContext) {
    const { reservationId, metadata, reason } = data;
    const reference = data.reference || `DOC-ESTADIA-${new Date().getFullYear()}-${idempotencyKey.slice(0, 6).toUpperCase()}`;
    const initialStatus = data.status || (metadata?.signatures?.guestSignature ? 'Vigente' : 'Borrador');

    return await this.db.transaction(async (tx: any) => {
      await acquirePropertyTransactionLock(tx, propertyId);
      const receipt = await this.findReceipt(tx, propertyId, 'documents.contract.create', idempotencyKey, {
        accountId,
        reservationId: reservationId ?? null,
        reference,
        initialStatus,
        metadata: metadata ?? {},
        reason: reason ?? null,
      });
      if (receipt) return receipt;

      await this.assertAccountBelongsToProperty(tx, accountId, propertyId);
      if (reservationId) {
        const [reservation] = await tx.select({ id: reservations.id }).from(reservations)
          .where(and(eq(reservations.id, reservationId), eq(reservations.propertyId, propertyId))).limit(1);
        if (!reservation) throw new NotFoundException('Reserva no encontrada');
      }

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

      const response = { ...newContract, versions: [newVersion], metadata: newVersion.metadata };
      await this.saveReceipt(tx, propertyId, 'documents.contract.create', idempotencyKey, {
        accountId,
        reservationId: reservationId ?? null,
        reference,
        initialStatus,
        metadata: metadata ?? {},
        reason: reason ?? null,
      }, response);
      return response;
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

  async transitionContract(propertyId: string, accountId: string, contractId: string, data: any, idempotencyKey: string, ctx: RequestContext) {
    const { targetState, reason } = data;
    if (!CONTRACT_TARGET_STATES.includes(targetState)) throw new BadRequestException('Estado de contrato inválido');
    const status = contractTargetStateToStatus[targetState as keyof typeof contractTargetStateToStatus];

    return await this.db.transaction(async (tx: any) => {
      await acquirePropertyTransactionLock(tx, propertyId);
      const receiptPayload = { accountId, contractId, targetState, reason: reason ?? null };
      const receipt = await this.findReceipt(tx, propertyId, 'documents.contract.transition', idempotencyKey, receiptPayload);
      if (receipt) return receipt;

      const [contract] = await tx
        .select()
        .from(contracts)
        .where(and(eq(contracts.propertyId, propertyId), eq(contracts.id, contractId)))
        .limit(1)
        .for('update');

      if (!contract) throw new NotFoundException('Contrato no encontrado');
      if (contract.status === status) {
        await this.saveReceipt(tx, propertyId, 'documents.contract.transition', idempotencyKey, receiptPayload, contract);
        return contract;
      }
      if (!allowedContractTransitions[contract.status]?.includes(status)) {
        throw new ConflictException('La transición de contrato no está permitida');
      }

      await this.assertAccountBelongsToProperty(tx, accountId, propertyId);
      const [updated] = await tx.update(contracts)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(contracts.id, contractId), eq(contracts.propertyId, propertyId)))
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

      await this.saveReceipt(tx, propertyId, 'documents.contract.transition', idempotencyKey, receiptPayload, updated);
      return updated;
    });
  }

  async registerEvidence(propertyId: string, accountId: string, data: any, idempotencyKey: string, ctx: RequestContext) {
    const { sourceType, referenceId, evidenceType, description, url, metadata } = data;
    const evidenceMetadata = {
      ...(metadata || {}),
      evidenceType,
      ...(url ? { url } : {}),
    };
    
    return await this.db.transaction(async (tx: any) => {
      await acquirePropertyTransactionLock(tx, propertyId);
      const receiptPayload = { accountId, sourceType, referenceId, evidenceType, description, url: url ?? null, metadata: metadata ?? {} };
      const receipt = await this.findReceipt(tx, propertyId, 'documents.evidence.register', idempotencyKey, receiptPayload);
      if (receipt) return receipt;

      await this.assertAccountBelongsToProperty(tx, accountId, propertyId);
      await this.assertEvidenceOriginBelongsToProperty(tx, propertyId, sourceType, referenceId);
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

      await this.saveReceipt(tx, propertyId, 'documents.evidence.register', idempotencyKey, receiptPayload, evidence);
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

  async linkEvidence(propertyId: string, accountId: string, contractId: string, data: any, idempotencyKey: string, ctx: RequestContext) {
    const { evidenceId, relationType } = data;

    return await this.db.transaction(async (tx: any) => {
      await acquirePropertyTransactionLock(tx, propertyId);
      const receiptPayload = { accountId, contractId, evidenceId, relationType };
      const receipt = await this.findReceipt(tx, propertyId, 'documents.evidence.link', idempotencyKey, receiptPayload);
      if (receipt) return receipt;

      await this.assertAccountBelongsToProperty(tx, accountId, propertyId);
      const [contract] = await tx.select({ id: contracts.id }).from(contracts)
        .where(and(eq(contracts.id, contractId), eq(contracts.propertyId, propertyId))).limit(1);
      if (!contract) throw new NotFoundException('Contrato no encontrado');
      const [evidence] = await tx.select({ id: evidences.id }).from(evidences)
        .where(and(eq(evidences.id, evidenceId), eq(evidences.propertyId, propertyId))).limit(1);
      if (!evidence) throw new NotFoundException('Evidencia no encontrada');

      const [existingLink] = await tx
        .select()
        .from(contractEvidenceLinks)
        .where(and(eq(contractEvidenceLinks.propertyId, propertyId), eq(contractEvidenceLinks.contractId, contractId), eq(contractEvidenceLinks.evidenceId, evidenceId)))
        .limit(1);
      if (existingLink) {
        if (existingLink.relationType !== relationType) throw new ConflictException('La evidencia ya está vinculada con otra relación');
        await this.saveReceipt(tx, propertyId, 'documents.evidence.link', idempotencyKey, receiptPayload, existingLink);
        return existingLink;
      }

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

      await this.saveReceipt(tx, propertyId, 'documents.evidence.link', idempotencyKey, receiptPayload, link);
      return link;
    });
  }

  private async findReceipt(tx: any, propertyId: string, operation: string, idempotencyKey: string, payload: unknown) {
    const fingerprint = requestFingerprint(payload);
    const [existing] = await tx.select({ response: commandReceipts.response, requestFingerprint: commandReceipts.requestFingerprint })
      .from(commandReceipts)
      .where(and(
        eq(commandReceipts.propertyId, propertyId),
        eq(commandReceipts.operation, operation),
        eq(commandReceipts.idempotencyKey, idempotencyKey),
      ))
      .limit(1);

    if (!existing) return null;
    if (existing.requestFingerprint !== fingerprint) throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
    return existing.response;
  }

  private async saveReceipt(tx: any, propertyId: string, operation: string, idempotencyKey: string, payload: unknown, response: unknown) {
    await tx.insert(commandReceipts).values({
      propertyId,
      operation,
      idempotencyKey,
      requestFingerprint: requestFingerprint(payload),
      responseStatus: 200,
      response,
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

  private async assertAccountBelongsToProperty(tx: any, accountId: string, propertyId: string) {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.propertyId, propertyId))).limit(1);
    if (!account) throw new NotFoundException('Cuenta no encontrada');
  }

  private async assertEvidenceOriginBelongsToProperty(tx: any, propertyId: string, sourceType: string, referenceId: string) {
    const origin = sourceType.toUpperCase();
    const [record] = origin === 'CLEANING'
      ? await tx.select({ id: cleaningTasks.id }).from(cleaningTasks)
        .where(and(eq(cleaningTasks.id, referenceId), eq(cleaningTasks.propertyId, propertyId))).limit(1)
      : origin === 'MAINTENANCE'
        ? await tx.select({ id: incidents.id }).from(incidents)
          .where(and(eq(incidents.id, referenceId), eq(incidents.propertyId, propertyId), eq(incidents.type, 'maintenance'))).limit(1)
        : origin === 'INCIDENTS'
          ? await tx.select({ id: incidents.id }).from(incidents)
            .where(and(eq(incidents.id, referenceId), eq(incidents.propertyId, propertyId))).limit(1)
          : await tx.select({ id: contracts.id }).from(contracts)
            .where(and(eq(contracts.id, referenceId), eq(contracts.propertyId, propertyId))).limit(1);
    if (!record) throw new NotFoundException('Origen de evidencia no encontrado');
  }
}
