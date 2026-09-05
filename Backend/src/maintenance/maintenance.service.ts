import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';
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
  room: { id: string; number: string; status: string } | null;
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

const ACTION_TRANSITIONS: Record<ProgressMaintenanceDto['action'], string[]> = {
  assign: ['pending'],
  start: ['assigned'],
  resolve: ['in_progress'],
  close: ['resolved'],
  reopen: ['resolved', 'closed'],
};

const ACTION_STATUS: Record<ProgressMaintenanceDto['action'], 'assigned' | 'in_progress' | 'resolved' | 'closed'> = {
  assign: 'assigned',
  start: 'in_progress',
  resolve: 'resolved',
  close: 'closed',
  reopen: 'in_progress',
};

@Injectable()
export class MaintenanceService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string): Promise<MaintenanceTicketResponse[]> {
    const rows = await this.database
      .select({ ticket: incidents, roomId: rooms.id, roomNumber: rooms.number, roomStatus: rooms.status })
      .from(incidents)
      .leftJoin(rooms, and(eq(incidents.roomId, rooms.id), eq(incidents.propertyId, rooms.propertyId)))
      .where(and(eq(incidents.propertyId, propertyId), eq(incidents.type, 'maintenance')))
      .orderBy(incidents.createdAt);
    return rows.map((row) => this.format(row.ticket, row.roomId ? { id: row.roomId, number: row.roomNumber!, status: row.roomStatus! } : null));
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
        const blockedRoom = await tx
          .update(rooms)
          .set({ status: 'maintenance' })
          .where(and(eq(rooms.id, dto.roomId), eq(rooms.propertyId, actor.propertyId), eq(rooms.status, 'available')))
          .returning({ id: rooms.id });
        if (blockedRoom.length === 0) {
          throw new ConflictException('Only an available room can be blocked for maintenance');
        }
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
          const blockedRoom = await tx
            .update(rooms)
            .set({ status: 'maintenance' })
            .where(and(eq(rooms.id, ticket.roomId), eq(rooms.propertyId, actor.propertyId), eq(rooms.status, 'available')))
            .returning({ id: rooms.id });
          if (blockedRoom.length === 0) {
            throw new ConflictException('Only an available room can be blocked for maintenance');
          }
        } else if (!dto.blocksRoom && ticket.blocksRoom) {
          throw new ConflictException('Close the ticket and explicitly release the room instead');
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

      if (!ACTION_TRANSITIONS[dto.action].includes(ticket.status)) {
        throw new ConflictException(`Action '${dto.action}' is not allowed for a ticket in status '${ticket.status}'`);
      }

      const nextStatus = ACTION_STATUS[dto.action];
      const evidence = dto.evidence ? [...ticket.evidence, dto.evidence] : ticket.evidence;
      const now = new Date();
      const blocksRoom = dto.action === 'close' && dto.releaseRoom ? false : ticket.blocksRoom;

      await tx
        .update(incidents)
        .set({
          status: nextStatus,
          responsible: dto.action === 'assign' ? dto.responsible! : ticket.responsible,
          solution: dto.action === 'resolve' ? dto.solution! : ticket.solution,
          evidence,
          blocksRoom,
          updatedAt: now,
        })
        .where(eq(incidents.id, ticket.id));

      if (dto.action === 'close' && dto.releaseRoom && ticket.blocksRoom && ticket.roomId) {
        const blockingTickets = await tx
          .select({ id: incidents.id })
          .from(incidents)
          .where(and(
            eq(incidents.propertyId, actor.propertyId),
            eq(incidents.roomId, ticket.roomId),
            eq(incidents.type, 'maintenance'),
            eq(incidents.blocksRoom, true),
            ne(incidents.id, ticket.id),
            inArray(incidents.status, ['pending', 'assigned', 'in_progress', 'resolved']),
          ));
        if (blockingTickets.length > 0) {
          throw new ConflictException('Room cannot be released while another maintenance ticket blocks it');
        }

        const room = await tx.select({ status: rooms.status }).from(rooms)
          .where(and(eq(rooms.id, ticket.roomId), eq(rooms.propertyId, actor.propertyId))).limit(1).for('update');
        if (!room[0] || room[0].status !== 'maintenance') {
          throw new ConflictException('Room is no longer in maintenance and cannot be released from this ticket');
        }
        await tx.update(rooms).set({ status: 'available' })
          .where(and(eq(rooms.id, ticket.roomId), eq(rooms.propertyId, actor.propertyId), eq(rooms.status, 'maintenance')));
      }

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'maintenance.progressed',
          subjectType: 'incident',
          subjectId: ticket.id,
          metadata: { action: dto.action, from: ticket.status, to: nextStatus, releaseRoom: dto.releaseRoom, roomId: ticket.roomId ?? null },
        },
        tx,
      );

      return this.format({
        ...ticket,
        status: nextStatus,
        responsible: dto.action === 'assign' ? dto.responsible! : ticket.responsible,
        solution: dto.action === 'resolve' ? dto.solution! : ticket.solution,
        blocksRoom,
        evidence,
        updatedAt: now,
      });
    });
  }

  private format(row: any, room: MaintenanceTicketResponse['room'] = null): MaintenanceTicketResponse {
    return {
      id: row.id,
      propertyId: row.propertyId,
      roomId: row.roomId ?? null,
      room,
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
