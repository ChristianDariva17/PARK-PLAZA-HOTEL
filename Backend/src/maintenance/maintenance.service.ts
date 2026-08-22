import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { incidents, rooms } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type { CreateMaintenanceDto, ProgressMaintenanceDto, UpdateMaintenanceDto } from './maintenance.dto.js';

export interface MaintenanceTicketResponse {
  id: string;
  propertyId: string;
  roomId: string | null;
  type: 'maintenance';
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
export class MaintenanceService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string): Promise<MaintenanceTicketResponse[]> {
    const rows = await this.database
      .select()
      .from(incidents)
      .where(and(eq(incidents.propertyId, propertyId), eq(incidents.type, 'maintenance')))
      .orderBy(incidents.createdAt);
    return rows.map((r) => this.format(r));
  }

  async create(
    actor: AuthenticatedAccount,
    dto: CreateMaintenanceDto,
    context: RequestContext,
  ): Promise<MaintenanceTicketResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const evidence = dto.evidence ? [dto.evidence] : [];
      const responsible = dto.responsible ?? 'Por asignar';

      const inserted = await tx
        .insert(incidents)
        .values({
          propertyId: actor.propertyId,
          roomId: dto.roomId ?? null,
          type: 'maintenance',
          referenceId: null,
          description: dto.description,
          priority: dto.priority,
          responsible,
          status: 'pending',
          blocksRoom: dto.blocksRoom,
          evidence,
        })
        .returning();

      const ticket = inserted[0]!;

      if (dto.blocksRoom && dto.roomId) {
        await tx
          .update(rooms)
          .set({ status: 'maintenance' })
          .where(and(eq(rooms.id, dto.roomId), eq(rooms.propertyId, actor.propertyId)));
      }

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'maintenance.created',
          subjectType: 'incident',
          subjectId: ticket.id,
          metadata: { roomId: dto.roomId ?? null, blocksRoom: dto.blocksRoom },
        },
        tx,
      );

      return this.format(ticket);
    });
  }

  async update(
    actor: AuthenticatedAccount,
    ticketId: string,
    dto: UpdateMaintenanceDto,
    context: RequestContext,
  ): Promise<MaintenanceTicketResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const rows = await tx
        .select()
        .from(incidents)
        .where(
          and(
            eq(incidents.id, ticketId),
            eq(incidents.propertyId, actor.propertyId),
            eq(incidents.type, 'maintenance'),
          ),
        )
        .limit(1)
        .for('update', { of: incidents });

      const ticket = rows[0];
      if (!ticket) throw new NotFoundException('Maintenance ticket not found');

      if (ticket.status === 'closed') {
        throw new ConflictException('Cannot update a closed maintenance ticket');
      }

      const evidence =
        dto.evidence ? [...ticket.evidence, dto.evidence] : ticket.evidence;

      const updatedFields = {
        description: dto.description ?? ticket.description,
        priority: dto.priority ?? ticket.priority,
        responsible: dto.responsible ?? ticket.responsible,
        solution: dto.solution !== undefined ? dto.solution : ticket.solution,
        evidence,
        blocksRoom: dto.blocksRoom !== undefined ? dto.blocksRoom : ticket.blocksRoom,
        updatedAt: new Date(),
      };

      await tx.update(incidents).set(updatedFields).where(eq(incidents.id, ticket.id));

      if (dto.blocksRoom !== undefined && ticket.roomId) {
        if (dto.blocksRoom && !ticket.blocksRoom) {
          await tx
            .update(rooms)
            .set({ status: 'maintenance' })
            .where(and(eq(rooms.id, ticket.roomId), eq(rooms.propertyId, actor.propertyId)));
        } else if (!dto.blocksRoom && ticket.blocksRoom) {
          await tx
            .update(rooms)
            .set({ status: 'available' })
            .where(and(eq(rooms.id, ticket.roomId), eq(rooms.propertyId, actor.propertyId)));
        }
      }

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'maintenance.updated',
          subjectType: 'incident',
          subjectId: ticket.id,
          metadata: { responsible: updatedFields.responsible },
        },
        tx,
      );

      return this.format({ ...ticket, ...updatedFields });
    });
  }

  async progress(
    actor: AuthenticatedAccount,
    ticketId: string,
    dto: ProgressMaintenanceDto,
    context: RequestContext,
  ): Promise<MaintenanceTicketResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const rows = await tx
        .select()
        .from(incidents)
        .where(
          and(
            eq(incidents.id, ticketId),
            eq(incidents.propertyId, actor.propertyId),
            eq(incidents.type, 'maintenance'),
          ),
        )
        .limit(1)
        .for('update', { of: incidents });

      const ticket = rows[0];
      if (!ticket) throw new NotFoundException('Maintenance ticket not found');

      if (dto.expectedStatus && ticket.status !== dto.expectedStatus) {
        throw new ConflictException(
          `Ticket status conflict: expected ${dto.expectedStatus} but found ${ticket.status}`,
        );
      }

      const allowed = STATUS_TRANSITIONS[ticket.status] ?? [];
      if (allowed.length === 0) {
        throw new ConflictException(`Ticket in status '${ticket.status}' cannot be progressed`);
      }

      const nextStatus = allowed[0] as typeof ticket.status;
      const evidence = dto.evidence ? [...ticket.evidence, dto.evidence] : ticket.evidence;
      const now = new Date();

      await tx
        .update(incidents)
        .set({ status: nextStatus, evidence, updatedAt: now })
        .where(eq(incidents.id, ticket.id));

      if ((nextStatus === 'resolved' || nextStatus === 'closed') && ticket.blocksRoom && ticket.roomId) {
        await tx
          .update(rooms)
          .set({ status: 'available' })
          .where(and(eq(rooms.id, ticket.roomId), eq(rooms.propertyId, actor.propertyId)));

        await tx
          .update(incidents)
          .set({ blocksRoom: false })
          .where(eq(incidents.id, ticket.id));
      }

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'maintenance.progressed',
          subjectType: 'incident',
          subjectId: ticket.id,
          metadata: { from: ticket.status, to: nextStatus, roomId: ticket.roomId ?? null },
        },
        tx,
      );

      return this.format({
        ...ticket,
        status: nextStatus,
        blocksRoom:
          nextStatus === 'resolved' || nextStatus === 'closed' ? false : ticket.blocksRoom,
        evidence,
        updatedAt: now,
      });
    });
  }

  private format(row: any): MaintenanceTicketResponse {
    return {
      id: row.id,
      propertyId: row.propertyId,
      roomId: row.roomId ?? null,
      type: 'maintenance',
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
