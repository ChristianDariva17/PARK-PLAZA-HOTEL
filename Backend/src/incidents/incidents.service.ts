import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { incidents, rooms } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type { CreateIncidentDto, ProgressIncidentDto, UpdateIncidentDto } from './incidents.dto.js';

export interface IncidentResponse {
  id: string;
  propertyId: string;
  roomId: string | null;
  type: string;
  referenceId: string | null;
  description: string;
  priority: string;
  responsible: string;
  status: string;
  blocksRoom: boolean;
  evidence: string[];
  solution: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:     ['assigned', 'in_progress'],
  assigned:    ['in_progress'],
  in_progress: ['resolved'],
  resolved:    ['closed', 'in_progress'],
  closed:      ['in_progress'],
};

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string): Promise<IncidentResponse[]> {
    const rows = await this.database
      .select()
      .from(incidents)
      .where(eq(incidents.propertyId, propertyId))
      .orderBy(incidents.createdAt);
    return rows.map((r) => this.format(r));
  }

  async create(
    actor: AuthenticatedAccount,
    dto: CreateIncidentDto,
    context: RequestContext,
  ): Promise<IncidentResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const evidence = dto.evidence ? [dto.evidence] : [];
      const responsible = dto.responsible ?? 'Por asignar';

      const inserted = await tx
        .insert(incidents)
        .values({
          propertyId: actor.propertyId,
          roomId: dto.roomId ?? null,
          type: dto.type,
          referenceId: dto.referenceId ?? null,
          description: dto.description,
          priority: dto.priority,
          responsible,
          status: 'pending',
          blocksRoom: dto.blocksRoom,
          evidence,
        })
        .returning();

      const incident = inserted[0]!;

      if (dto.blocksRoom && dto.roomId) {
        await tx
          .update(rooms)
          .set({ status: dto.type === 'maintenance' ? 'maintenance' : 'blocked' })
          .where(and(eq(rooms.id, dto.roomId), eq(rooms.propertyId, actor.propertyId)));
      }

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'incident.created',
          subjectType: 'incident',
          subjectId: incident.id,
          metadata: { type: dto.type, roomId: dto.roomId ?? null, blocksRoom: dto.blocksRoom },
        },
        tx,
      );

      return this.format(incident);
    });
  }

  async update(
    actor: AuthenticatedAccount,
    incidentId: string,
    dto: UpdateIncidentDto,
    context: RequestContext,
  ): Promise<IncidentResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const rows = await tx
        .select()
        .from(incidents)
        .where(and(eq(incidents.id, incidentId), eq(incidents.propertyId, actor.propertyId)))
        .limit(1)
        .for('update', { of: incidents });

      const incident = rows[0];
      if (!incident) throw new NotFoundException('Incident not found');

      if (incident.status === 'closed') {
        throw new ConflictException('Cannot update a closed incident');
      }

      const evidence =
        dto.evidence ? [...incident.evidence, dto.evidence] : incident.evidence;

      const updatedFields = {
        description: dto.description ?? incident.description,
        priority: dto.priority ?? incident.priority,
        responsible: dto.responsible ?? incident.responsible,
        solution: dto.solution !== undefined ? dto.solution : incident.solution,
        evidence,
        blocksRoom: dto.blocksRoom !== undefined ? dto.blocksRoom : incident.blocksRoom,
        updatedAt: new Date(),
      };

      await tx.update(incidents).set(updatedFields).where(eq(incidents.id, incident.id));

      // If blocksRoom changed and room is linked, sync room status
      if (dto.blocksRoom !== undefined && incident.roomId) {
        if (dto.blocksRoom && !incident.blocksRoom) {
          await tx
            .update(rooms)
            .set({ status: incident.type === 'maintenance' ? 'maintenance' : 'blocked' })
            .where(and(eq(rooms.id, incident.roomId), eq(rooms.propertyId, actor.propertyId)));
        } else if (!dto.blocksRoom && incident.blocksRoom) {
          await tx
            .update(rooms)
            .set({ status: 'available' })
            .where(and(eq(rooms.id, incident.roomId), eq(rooms.propertyId, actor.propertyId)));
        }
      }

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'incident.updated',
          subjectType: 'incident',
          subjectId: incident.id,
          metadata: { responsible: updatedFields.responsible },
        },
        tx,
      );

      return this.format({ ...incident, ...updatedFields });
    });
  }

  async progress(
    actor: AuthenticatedAccount,
    incidentId: string,
    dto: ProgressIncidentDto,
    context: RequestContext,
  ): Promise<IncidentResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const rows = await tx
        .select()
        .from(incidents)
        .where(and(eq(incidents.id, incidentId), eq(incidents.propertyId, actor.propertyId)))
        .limit(1)
        .for('update', { of: incidents });

      const incident = rows[0];
      if (!incident) throw new NotFoundException('Incident not found');

      if (dto.expectedStatus && incident.status !== dto.expectedStatus) {
        throw new ConflictException(
          `Incident status conflict: expected ${dto.expectedStatus} but found ${incident.status}`,
        );
      }

      const allowed = STATUS_TRANSITIONS[incident.status] ?? [];
      if (allowed.length === 0) {
        throw new ConflictException(`Incident in status '${incident.status}' cannot be progressed`);
      }

      const nextStatus = allowed[0] as typeof incident.status;
      const evidence = dto.evidence ? [...incident.evidence, dto.evidence] : incident.evidence;
      const now = new Date();

      await tx
        .update(incidents)
        .set({ status: nextStatus, evidence, updatedAt: now })
        .where(eq(incidents.id, incident.id));

      // Release room block when resolved or closed
      if ((nextStatus === 'resolved' || nextStatus === 'closed') && incident.blocksRoom && incident.roomId) {
        await tx
          .update(rooms)
          .set({ status: 'available' })
          .where(and(eq(rooms.id, incident.roomId), eq(rooms.propertyId, actor.propertyId)));

        await tx
          .update(incidents)
          .set({ blocksRoom: false })
          .where(eq(incidents.id, incident.id));
      }

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'incident.progressed',
          subjectType: 'incident',
          subjectId: incident.id,
          metadata: { from: incident.status, to: nextStatus, roomId: incident.roomId ?? null },
        },
        tx,
      );

      return this.format({
        ...incident,
        status: nextStatus,
        blocksRoom:
          nextStatus === 'resolved' || nextStatus === 'closed' ? false : incident.blocksRoom,
        evidence,
        updatedAt: now,
      });
    });
  }

  private format(row: any): IncidentResponse {
    return {
      id: row.id,
      propertyId: row.propertyId,
      roomId: row.roomId ?? null,
      type: row.type,
      referenceId: row.referenceId ?? null,
      description: row.description,
      priority: row.priority,
      responsible: row.responsible,
      status: row.status,
      blocksRoom: row.blocksRoom,
      evidence: Array.isArray(row.evidence) ? row.evidence : [],
      solution: row.solution ?? '',
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
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
