import { sql } from 'drizzle-orm';
import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE, type Database } from '../database/database.module.js';
import { staff, staffProfiles } from '../database/schema/index.js';
import { AuditService } from '../audit/audit.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import * as schema from '../database/schema/index.js';

@Injectable()
export class StaffService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async listStaff(propertyId: string) {
    return this.database
      .select({
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        documentNormalized: staffProfiles.documentNormalized,
        position: staffProfiles.position,
        department: staffProfiles.department,
        status: staffProfiles.status,
      })
      .from(staff)
      .leftJoin(staffProfiles, eq(staff.id, staffProfiles.staffId))
      .where(eq(staff.propertyId, propertyId));
  }

  async getStaff(id: string, propertyId: string) {
    const [result] = await this.database
      .select({
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        documentNormalized: staffProfiles.documentNormalized,
        position: staffProfiles.position,
        department: staffProfiles.department,
        status: staffProfiles.status,
      })
      .from(staff)
      .leftJoin(staffProfiles, eq(staff.id, staffProfiles.staffId))
      .where(and(eq(staff.id, id), eq(staff.propertyId, propertyId)))
      .limit(1);

    if (!result) throw new NotFoundException('Personal no encontrado');
    return result;
  }

  async createStaff(propertyId: string, payload: any, reqContext: RequestContext) {
    return this.database.transaction(async (tx) => {
      const existing = await tx.select({ id: staffProfiles.id }).from(staffProfiles)
        .where(and(
          eq(staffProfiles.propertyId, propertyId), 
          eq(staffProfiles.documentNormalized, payload.documentNormalized), 
          eq(staffProfiles.status, 'Activo')
        ))
        .limit(1);
      if (existing.length > 0) {
        throw new ConflictException('Ya existe un perfil de personal activo con este documento');
      }

      const [newStaff] = await tx.insert(staff).values({
        propertyId,
        firstName: payload.firstName,
        lastName: payload.lastName,
      }).returning();

      const [newProfile] = await tx.insert(staffProfiles).values({
        propertyId,
        staffId: newStaff!.id,
        documentNormalized: payload.documentNormalized,
        position: payload.position,
        department: payload.department,
        phone: payload.phone,
        email: payload.email,
        status: 'Activo',
      }).returning();

      await this.audit.record({
                eventType: 'staff.created',
        propertyId,
        actorAccountId: (reqContext as any).accountId,
        subjectType: 'staff',
        subjectId: newStaff!.id,
        metadata: {
          documentNormalized: newProfile!.documentNormalized,
        },
        ...reqContext,
      }, tx as any);

      return { ...newStaff, ...newProfile, id: newStaff!.id };
    });
  }

  async updateStaff(id: string, propertyId: string, payload: any, reqContext: RequestContext) {
    return this.database.transaction(async (tx) => {
      const existing = await tx.select({ id: staff.id }).from(staff)
        .where(and(eq(staff.id, id), eq(staff.propertyId, propertyId)))
        .limit(1);
      if (existing.length === 0) throw new NotFoundException('Personal no encontrado');

      if (payload.documentNormalized) {
        const duplicate = await tx.select({ staffId: staffProfiles.staffId }).from(staffProfiles)
          .where(and(
            eq(staffProfiles.propertyId, propertyId), 
            eq(staffProfiles.documentNormalized, payload.documentNormalized),
            eq(staffProfiles.status, 'Activo')
          ))
          .limit(1);
        if (duplicate.length > 0 && duplicate[0]!.staffId !== id) {
          throw new ConflictException('Ya existe un perfil de personal activo con este documento');
        }
      }

      const staffUpdate: any = {};
      if (payload.firstName !== undefined) staffUpdate.firstName = payload.firstName;
      if (payload.lastName !== undefined) staffUpdate.lastName = payload.lastName;
      if (Object.keys(staffUpdate).length > 0) {
        staffUpdate.updatedAt = new Date();
        await tx.update(staff).set(staffUpdate).where(eq(staff.id, id));
      }

      const profileUpdate: any = {};
      if (payload.documentNormalized !== undefined) profileUpdate.documentNormalized = payload.documentNormalized;
      if (payload.position !== undefined) profileUpdate.position = payload.position;
      if (payload.department !== undefined) profileUpdate.department = payload.department;
      if (payload.phone !== undefined) profileUpdate.phone = payload.phone;
      if (payload.email !== undefined) profileUpdate.email = payload.email;
      if (Object.keys(profileUpdate).length > 0) {
        profileUpdate.updatedAt = new Date();
        await tx.update(staffProfiles).set(profileUpdate).where(eq(staffProfiles.staffId, id));
      }

      await this.audit.record({
                eventType: 'staff.updated',
        propertyId,
        actorAccountId: (reqContext as any).accountId,
        subjectType: 'staff',
        subjectId: id,
        metadata: { updatedFields: Object.keys(payload) },
        ...reqContext,
      }, tx as any);

      return { success: true };
    });
  }

  async archiveStaff(id: string, propertyId: string, payload: any, reqContext: RequestContext) {
    return this.database.transaction(async (tx) => {
       const [existingStaff] = await tx.select({ id: schema.staff.id, accountId: schema.staff.accountId }).from(schema.staff).where(and(eq(schema.staff.id, id), eq(schema.staff.propertyId, propertyId))).limit(1);
       if (!existingStaff) throw new NotFoundException('Personal no encontrado');

       const [existingProfile] = await tx.select().from(schema.staffProfiles).where(eq(schema.staffProfiles.staffId, id)).limit(1);
       if (!existingProfile) throw new NotFoundException('Personal no encontrado');
       if (existingProfile.status === 'Archivado') throw new ConflictException('El personal ya está archivado');

       await tx.update(schema.staffProfiles).set({ status: 'Archivado', updatedAt: new Date() }).where(eq(schema.staffProfiles.staffId, id));

       // Disable linked account and revoke sessions
       if (existingStaff.accountId) {
         await tx.update(schema.accounts).set({ status: 'disabled', updatedAt: new Date() }).where(eq(schema.accounts.id, existingStaff.accountId));
         await tx.update(schema.sessions).set({ revokedAt: new Date(), revocationReason: 'staff_archived' }).where(and(eq(schema.sessions.accountId, existingStaff.accountId), sql`${schema.sessions.revokedAt} IS NULL`));
         
         await this.audit.record({
           eventType: 'account.disabled',
           propertyId,
           actorAccountId: (reqContext as any).accountId,
           subjectType: 'account',
           subjectId: existingStaff.accountId,
           metadata: { reason: 'staff_archived' },
           ...reqContext,
         }, tx as any);
       }

       // End active work schedule assignments
       await tx.update(schema.workScheduleAssignments).set({ validTo: new Date() })
         .where(and(
           eq(schema.workScheduleAssignments.staffId, id),
           sql`${schema.workScheduleAssignments.validTo} IS NULL OR ${schema.workScheduleAssignments.validTo} > NOW()`
         ));

       // Cancel upcoming shift instances
       await tx.update(schema.shiftInstances).set({ status: 'Cancelado', cancellationReason: 'Personal archivado' })
         .where(and(
           eq(schema.shiftInstances.staffId, id),
           eq(schema.shiftInstances.status, 'Programado'),
           sql`${schema.shiftInstances.plannedStartAt} > NOW()`
         ));

       // Revoke biometric bindings
       await tx.update(schema.staffBiometricBindings).set({ status: 'Revocado', revokedAt: new Date() })
         .where(and(eq(schema.staffBiometricBindings.staffId, id), eq(schema.staffBiometricBindings.status, 'Activo')));

       await this.audit.record({
                  eventType: 'staff.archived',
         propertyId,
         actorAccountId: (reqContext as any).accountId,
         subjectType: 'staff',
         subjectId: id,
         metadata: { reason: payload.reason },
         ...reqContext,
       }, tx as any);

       return { success: true };
    });
  }

  async reactivateStaff(id: string, propertyId: string, payload: any, reqContext: RequestContext) {
    return this.database.transaction(async (tx) => {
       const [existing] = await tx.select().from(staffProfiles).where(eq(staffProfiles.staffId, id)).limit(1);
       if (!existing || existing.propertyId !== propertyId) throw new NotFoundException('Personal no encontrado');
       if (existing.status === 'Activo') throw new ConflictException('El personal ya está activo');

       const duplicate = await tx.select().from(staffProfiles)
         .where(and(eq(staffProfiles.propertyId, propertyId), eq(staffProfiles.documentNormalized, existing.documentNormalized), eq(staffProfiles.status, 'Activo')))
         .limit(1);
       
       if (duplicate.length > 0) throw new ConflictException('No se puede reactivar porque ya existe otro perfil activo con este documento');

       await tx.update(staffProfiles).set({ status: 'Activo', updatedAt: new Date() }).where(eq(staffProfiles.staffId, id));

       await this.audit.record({
                  eventType: 'staff.reactivated',
         propertyId,
         actorAccountId: (reqContext as any).accountId,
         subjectType: 'staff',
         subjectId: id,
         metadata: { reason: payload.reason },
         ...reqContext,
       }, tx as any);

       return { success: true };
    });
  }

  async createWorkSchedule(propertyId: string, payload: any, reqContext: RequestContext) {
    return this.database.transaction(async (tx) => {
      const [schedule] = await tx.insert(schema.workSchedules).values({
        propertyId,
        name: payload.name,
        ianaTimezone: payload.ianaTimezone,
        status: 'Activo',
      }).returning();

      await this.audit.record({
                eventType: 'work_schedule.created',
        propertyId,
        actorAccountId: (reqContext as any).accountId,
        subjectType: 'work_schedule',
        subjectId: schedule!.id,
        metadata: { name: schedule!.name, timezone: schedule!.ianaTimezone },
        ...reqContext,
      }, tx as any);

      return schedule;
    });
  }

  async listWorkSchedules(propertyId: string) {
    return this.database.select().from(schema.workSchedules).where(eq(schema.workSchedules.propertyId, propertyId));
  }

  async assignWorkSchedule(staffId: string, propertyId: string, payload: any, reqContext: RequestContext) {
    return this.database.transaction(async (tx) => {
      // Validate staff
      const [staff] = await tx.select({ id: schema.staff.id }).from(schema.staff)
        .where(and(eq(schema.staff.id, staffId), eq(schema.staff.propertyId, propertyId))).limit(1);
      if (!staff) throw new NotFoundException('Personal no encontrado');

      // Validate schedule
      const [schedule] = await tx.select().from(schema.workSchedules)
        .where(and(eq(schema.workSchedules.id, payload.workScheduleId), eq(schema.workSchedules.propertyId, propertyId))).limit(1);
      if (!schedule || schedule.status !== 'Activo') throw new NotFoundException('Horario no encontrado o inactivo');

      // Check overlap with existing active assignments (simplification: just check if validTo is null or >= validFrom)
      const existing = await tx.select().from(schema.workScheduleAssignments)
        .where(and(
          eq(schema.workScheduleAssignments.staffId, staffId),
          sql`${schema.workScheduleAssignments.validTo} IS NULL OR ${schema.workScheduleAssignments.validTo} >= ${payload.validFrom}`
        ));
      if (existing.length > 0) {
        throw new ConflictException('El personal ya tiene una asignación activa que se superpone con este periodo');
      }

      const [assignment] = await tx.insert(schema.workScheduleAssignments).values({
        staffId,
        workScheduleId: payload.workScheduleId,
        validFrom: payload.validFrom,
        validTo: payload.validTo,
        pattern: payload.pattern,
      }).returning();

      // Generate shift instances for the next 30 days
      const daysToProject = 30;
      await this.generateShiftInstances(tx, assignment!, schedule!.ianaTimezone, daysToProject, propertyId);

      await this.audit.record({
                eventType: 'work_schedule.assigned',
        propertyId,
        actorAccountId: (reqContext as any).accountId,
        subjectType: 'work_schedule_assignment',
        subjectId: assignment!.id,
        metadata: { staffId, scheduleId: schedule!.id, validFrom: payload.validFrom },
        ...reqContext,
      }, tx as any);

      return assignment;
    });
  }

  private async generateShiftInstances(tx: any, assignment: typeof schema.workScheduleAssignments.$inferSelect, timezone: string, daysToProject: number, propertyId: string) {
    const today = new Date();
    const pattern = assignment.pattern as Record<string, Array<{start: string, end: string}>>;

    for (let i = 0; i < daysToProject; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      
      if (assignment.validTo && targetDate > assignment.validTo) break;

      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
      const parts = formatter.formatToParts(targetDate);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      
      const dateString = `${year}-${month}-${day}`;
      const targetDateInTz = new Date(`${dateString}T12:00:00Z`);
      const dayOfWeek = targetDateInTz.getUTCDay().toString();

      const dayPattern = pattern[dayOfWeek];
      if (dayPattern && Array.isArray(dayPattern)) {
        for (const interval of dayPattern) {
          // Parse HH:mm
          const [startH, startM] = interval.start.split(':').map(Number);
          const [endH, endM] = interval.end.split(':').map(Number);

          // Construct ISO strings. To handle timezones properly in Drizzle without libraries,
          // we can use a raw SQL expression to insert the timestamp with time zone correctly:
          // e.g. sql`(${`${dateString} ${interval.start}:00`}::timestamp AT TIME ZONE ${timezone})`
          
          let endDateString = dateString;
          // Handle midnight crossing
          if (endH! < startH! || (endH === startH && endM! < startM!)) {
            const nextDay = new Date(targetDateInTz);
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            const ndYear = nextDay.getUTCFullYear();
            const ndMonth = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
            const ndDay = String(nextDay.getUTCDate()).padStart(2, '0');
            endDateString = `${ndYear}-${ndMonth}-${ndDay}`;
          }

          await tx.insert(schema.shiftInstances).values({
            propertyId,
            staffId: assignment.staffId,
            plannedStartAt: sql`(${`${dateString} ${interval.start}:00`}::timestamp AT TIME ZONE ${timezone})`,
            plannedEndAt: sql`(${`${endDateString} ${interval.end}:00`}::timestamp AT TIME ZONE ${timezone})`,
            ianaTimezone: timezone,
            origin: 'Generado',
            status: 'Programado',
          });
        }
      }
    }
  }
}
