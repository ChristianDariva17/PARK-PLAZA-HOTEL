import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { cleaningCommands, cleaningTasks, incidents, rooms } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type { CreateIncidentDto, ProgressCleaningTaskDto, UpdateCleaningTaskDto } from './cleaning.dto.js';

export interface PersistentCleaningTaskResponse {
  id: string;
  propertyId: string;
  roomId: string;
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
  ) {}

  async list(propertyId: string): Promise<PersistentCleaningTaskResponse[]> {
    const rows = await this.database
      .select()
      .from(cleaningTasks)
      .where(eq(cleaningTasks.propertyId, propertyId));

    return rows.map((task) => this.formatTask(task));
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

      const now = new Date();
      const startedAt = nextStatus === 'in_progress' ? now : task.startedAt;
      const completedAt = nextStatus === 'completed' ? now : task.completedAt;
      const evidence = dto.evidence ? [...task.evidence, dto.evidence] : task.evidence;

      await tx
        .update(cleaningTasks)
        .set({ status: nextStatus, startedAt, completedAt, evidence, updatedAt: now })
        .where(eq(cleaningTasks.id, task.id));

      let roomResponse: { id: string; status: string } | undefined = undefined;

      if (nextStatus === 'approved') {
        const roomRows = await tx
          .select({ id: rooms.id, status: rooms.status })
          .from(rooms)
          .where(and(eq(rooms.id, task.roomId), eq(rooms.propertyId, actor.propertyId)))
          .limit(1)
          .for('update', { of: rooms });

        const room = roomRows[0];
        if (room && room.status === 'cleaning') {
          await tx.update(rooms).set({ status: 'available' }).where(eq(rooms.id, room.id));
          roomResponse = { id: room.id, status: 'available' };
        }
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

      return response;
    });
  }

  private formatTask(task: any): PersistentCleaningTaskResponse {
    return {
      id: task.id,
      propertyId: task.propertyId,
      roomId: task.roomId,
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
