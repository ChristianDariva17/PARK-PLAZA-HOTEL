import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { cleaningCommands, cleaningTasks, incidents, rooms, stays } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type { CreateCleaningTaskDto, CreateIncidentDto, ProgressCleaningTaskDto, UpdateCleaningTaskDto } from './cleaning.dto.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

export interface PersistentCleaningTaskResponse {
  id: string;
  propertyId: string;
  roomId: string;
  stayId: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'approved';
  assignedTo: string;
  reason: string;
  observation: string | null;
  evidence: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CleaningCommandResponse extends Record<string, unknown> {
  task: PersistentCleaningTaskResponse;
  room?: { id: string; status: string };
  incident?: { id: string; status: string; blocksRoom: boolean };
}

@Injectable()
export class CleaningService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(propertyId: string): Promise<PersistentCleaningTaskResponse[]> {
    const rows = await this.database
      .select()
      .from(cleaningTasks)
      .where(eq(cleaningTasks.propertyId, propertyId));

    return rows.map((task) => this.formatTask(task));
  }

  async createTask(
    actor: AuthenticatedAccount,
    dto: CreateCleaningTaskDto,
    key: string,
    context: RequestContext,
  ): Promise<CleaningCommandResponse> {
    return this.command(actor, 'cleaning_create', key, async (tx) => {
      const roomRows = await tx
        .select()
        .from(rooms)
        .where(and(eq(rooms.id, dto.roomId), eq(rooms.propertyId, actor.propertyId)))
        .limit(1)
        .for('update', { of: rooms });

      const room = roomRows[0];
      if (!room) throw new NotFoundException('Room not found');

      const now = new Date();
      const inserted = await tx
        .insert(cleaningTasks)
        .values({
          propertyId: actor.propertyId,
          roomId: dto.roomId,
          status: 'pending',
          assignedTo: dto.assignedTo || 'Por asignar',
          reason: dto.reason || 'Check-out completado',
          observation: dto.observation || null,
          evidence: [],
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const task = inserted[0];

      let roomResponse: { id: string; status: string } | undefined = undefined;
      if (room.status === 'available' || room.status === 'occupied') {
        await tx.update(rooms).set({ status: 'cleaning' }).where(eq(rooms.id, room.id));
        roomResponse = { id: room.id, status: 'cleaning' };
      }

      const response: CleaningCommandResponse = {
        task: this.formatTask(task),
        ...(roomResponse ? { room: roomResponse } : {}),
      };

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'cleaning.created',
          subjectType: 'cleaning_task',
          subjectId: task.id,
          metadata: { roomId: task.roomId, reason: task.reason, assignedTo: task.assignedTo },
        },
        tx,
      );

      return response;
    });
  }

  async updateTask(
    actor: AuthenticatedAccount,
    taskId: string,
    dto: UpdateCleaningTaskDto,
    key: string,
    context: RequestContext,
  ): Promise<CleaningCommandResponse> {
    return this.command(actor, 'cleaning_update', key, async (tx) => {
      const rows = await tx
        .select()
        .from(cleaningTasks)
        .where(and(eq(cleaningTasks.id, taskId), eq(cleaningTasks.propertyId, actor.propertyId)))
        .limit(1)
        .for('update', { of: cleaningTasks });

      const task = rows[0];
      if (!task) throw new NotFoundException('Cleaning task not found');

      const evidence = dto.evidence ? [...task.evidence, dto.evidence] : task.evidence;
      const now = new Date();
      const updatedFields = {
        assignedTo: dto.assignedTo ?? task.assignedTo,
        observation: dto.observation !== undefined ? dto.observation : task.observation,
        evidence,
        updatedAt: now,
      };

      await tx.update(cleaningTasks).set(updatedFields).where(eq(cleaningTasks.id, task.id));

      const updatedTask = { ...task, ...updatedFields };
      const response: CleaningCommandResponse = { task: this.formatTask(updatedTask) };

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'cleaning.updated',
          subjectType: 'cleaning_task',
          subjectId: task.id,
          metadata: { assignedTo: updatedFields.assignedTo, observation: updatedFields.observation ?? null },
        },
        tx,
      );

      return response;
    });
  }

  async progressTask(
    actor: AuthenticatedAccount,
    taskId: string,
    dto: ProgressCleaningTaskDto,
    key: string,
    context: RequestContext,
  ): Promise<CleaningCommandResponse> {
    return this.command(actor, 'cleaning_progress', key, async (tx) => {
      const rows = await tx
        .select()
        .from(cleaningTasks)
        .where(and(eq(cleaningTasks.id, taskId), eq(cleaningTasks.propertyId, actor.propertyId)))
        .limit(1)
        .for('update', { of: cleaningTasks });

      const task = rows[0];
      if (!task) throw new NotFoundException('Cleaning task not found');

      if (dto.expectedStatus && task.status !== dto.expectedStatus) {
        throw new ConflictException(`Task status conflict: expected ${dto.expectedStatus} but found ${task.status}`);
      }

      if (task.status === 'approved') {
        throw new ConflictException('Cleaning task is already approved');
      }

      let nextStatus: 'in_progress' | 'completed' | 'approved';
      if (task.status === 'pending') nextStatus = 'in_progress';
      else if (task.status === 'in_progress') nextStatus = 'completed';
      else nextStatus = 'approved';

      let roomResponse: { id: string; status: string } | undefined = undefined;
      let incidentResponse: { id: string; status: string; blocksRoom: boolean } | undefined = undefined;
      let room: { id: string; status: string } | undefined = undefined;

      if (nextStatus === 'approved' && task.stayId) {
        const stayRows = await tx
          .select({ id: stays.id })
          .from(stays)
          .where(and(
            eq(stays.id, task.stayId),
            eq(stays.propertyId, actor.propertyId),
            eq(stays.roomId, task.roomId),
            eq(stays.status, 'checked_out'),
          ))
          .limit(1)
          .for('update', { of: stays });

        if (!stayRows[0]) throw new ConflictException('Cleaning task is not linked to a checked-out stay');

        const roomRows = await tx
          .select({ id: rooms.id, status: rooms.status })
          .from(rooms)
          .where(and(eq(rooms.id, task.roomId), eq(rooms.propertyId, actor.propertyId)))
          .limit(1)
          .for('update', { of: rooms });

        room = roomRows[0];
      }

      const now = new Date();
      const startedAt = nextStatus === 'in_progress' ? now : task.startedAt;
      const completedAt = nextStatus === 'completed' ? now : task.completedAt;
      const evidence = dto.evidence ? [...task.evidence, dto.evidence] : task.evidence;

      await tx
        .update(cleaningTasks)
        .set({ status: nextStatus, startedAt, completedAt, evidence, updatedAt: now })
        .where(eq(cleaningTasks.id, task.id));

      if (nextStatus === 'approved') {
        if (room?.status === 'cleaning') {
          await tx.update(rooms).set({ status: 'available' }).where(eq(rooms.id, room.id));
          roomResponse = { id: room.id, status: 'available' };
        }

        const existingIncident = await tx
          .select({ id: incidents.id, status: incidents.status, blocksRoom: incidents.blocksRoom })
          .from(incidents)
          .where(and(
            eq(incidents.propertyId, actor.propertyId),
            eq(incidents.type, 'cleaning'),
            eq(incidents.referenceId, task.id),
          ))
          .limit(1);

        const incident = existingIncident[0] ?? (await tx.insert(incidents).values({
          propertyId: actor.propertyId,
          roomId: task.roomId,
          type: 'cleaning',
          referenceId: task.id,
          description: `Limpieza completada y aprobada: ${task.reason}`,
          priority: 'low',
          responsible: task.assignedTo,
          status: 'closed',
          blocksRoom: false,
          evidence,
        }).returning({ id: incidents.id, status: incidents.status, blocksRoom: incidents.blocksRoom }))[0];

        incidentResponse = incident;
      }

      const updatedTask = {
        ...task,
        status: nextStatus,
        startedAt,
        completedAt,
        evidence,
        updatedAt: now,
      };

      const response: CleaningCommandResponse = {
        task: this.formatTask(updatedTask),
        ...(roomResponse ? { room: roomResponse } : {}),
        ...(incidentResponse ? { incident: incidentResponse } : {}),
      };

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'cleaning.progressed',
          subjectType: 'cleaning_task',
          subjectId: task.id,
          metadata: { status: nextStatus, roomId: task.roomId },
        },
        tx,
      );

      return response;
    });
  }

  async reportIncident(
    actor: AuthenticatedAccount,
    taskId: string,
    dto: CreateIncidentDto,
    key: string,
    context: RequestContext,
  ): Promise<CleaningCommandResponse> {
    return this.command(actor, 'cleaning_incident', key, async (tx) => {
      const rows = await tx
        .select()
        .from(cleaningTasks)
        .where(and(eq(cleaningTasks.id, taskId), eq(cleaningTasks.propertyId, actor.propertyId)))
        .limit(1);

      const task = rows[0];
      if (!task) throw new NotFoundException('Cleaning task not found');

      const evidence = dto.evidence ? [dto.evidence] : [];
      const responsible = dto.responsible ?? task.assignedTo;

      const inserted = await tx
        .insert(incidents)
        .values({
          propertyId: actor.propertyId,
          roomId: task.roomId,
          type: 'cleaning',
          referenceId: task.id,
          description: dto.description,
          priority: dto.priority,
          responsible,
          status: 'pending',
          blocksRoom: dto.blocksRoom,
          evidence,
        })
        .returning();

      const incident = inserted[0];
      let roomResponse: { id: string; status: string } | undefined = undefined;

      if (dto.blocksRoom) {
        await tx.update(rooms).set({ status: 'blocked' }).where(and(eq(rooms.id, task.roomId), eq(rooms.propertyId, actor.propertyId)));
        roomResponse = { id: task.roomId, status: 'blocked' };
      }

      const response: CleaningCommandResponse = {
        task: this.formatTask(task),
        ...(roomResponse ? { room: roomResponse } : {}),
        incident: { id: incident.id, status: incident.status, blocksRoom: incident.blocksRoom },
      };

      await this.audit.record(
        {
          ...this.auditBase(actor, context),
          eventType: 'cleaning.incident_created',
          subjectType: 'incident',
          subjectId: incident.id,
          metadata: { taskId: task.id, roomId: task.roomId, blocksRoom: dto.blocksRoom },
        },
        tx,
      );

      return response;
    });
  }

  private async command(
    actor: AuthenticatedAccount,
    operation: string,
    key: string,
    run: (tx: any) => Promise<CleaningCommandResponse>,
  ): Promise<CleaningCommandResponse> {
    return this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const receiptRows = await tx
        .select({ response: cleaningCommands.response })
        .from(cleaningCommands)
        .where(
          and(
            eq(cleaningCommands.propertyId, actor.propertyId),
            eq(cleaningCommands.operation, operation),
            eq(cleaningCommands.idempotencyKey, key),
          ),
        )
        .limit(1);

      if (receiptRows[0]) return receiptRows[0].response as unknown as CleaningCommandResponse;

      const response = await run(tx);
      await tx.insert(cleaningCommands).values({
        propertyId: actor.propertyId,
        operation,
        idempotencyKey: key,
        response: response as unknown as Record<string, unknown>,
      });

      this.realtime.emitToProperty(actor.propertyId, 'cleaning:task_updated', response.task);
      if (response.room) {
        this.realtime.emitToProperty(actor.propertyId, 'room:status_changed', response.room);
      }

      return response;
    });
  }

  private formatTask(task: any): PersistentCleaningTaskResponse {
    return {
      id: task.id,
      propertyId: task.propertyId,
      roomId: task.roomId,
      stayId: task.stayId ?? null,
      status: task.status,
      assignedTo: task.assignedTo,
      reason: task.reason,
      observation: task.observation ?? null,
      evidence: Array.isArray(task.evidence) ? task.evidence : [],
      startedAt: task.startedAt ? task.startedAt.toISOString() : null,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
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
