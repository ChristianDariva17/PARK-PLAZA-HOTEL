import { Inject, Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE, type Database } from '../database/database.module.js';
import { attendanceEvents, attendanceCorrections, shiftInstances, staff } from '../database/schema/index.js';
import { AuditService } from '../audit/audit.service.js';
import { GeofenceService } from './geofence.service.js';
import { DynamicQrService } from './dynamic-qr.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import * as schema from '../database/schema/index.js';
import { randomUUID } from 'crypto';

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly geofenceService: GeofenceService,
    private readonly dynamicQrService: DynamicQrService,
  ) {}

  async listEvents(propertyId: string) {
    return this.database
      .select({
        id: attendanceEvents.id,
        staffId: attendanceEvents.staffId,
        movement: attendanceEvents.movement,
        method: attendanceEvents.method,
        status: attendanceEvents.status,
        occurredAt: attendanceEvents.occurredAt,
        metadata: attendanceEvents.metadata,
      })
      .from(attendanceEvents)
      .where(eq(attendanceEvents.propertyId, propertyId));
  }

  async fetchCanonicalEvents(propertyId: string, staffId: string, fromDate: Date, toDate: Date) {
    return this.database
      .select({
        id: attendanceEvents.id,
        staffId: attendanceEvents.staffId,
        movement: attendanceEvents.movement,
        method: attendanceEvents.method,
        status: attendanceEvents.status,
        occurredAt: attendanceEvents.occurredAt,
      })
      .from(attendanceEvents)
      .where(
        and(
          eq(attendanceEvents.propertyId, propertyId),
          eq(attendanceEvents.staffId, staffId),
          sql`${attendanceEvents.occurredAt} >= ${fromDate}`,
          sql`${attendanceEvents.occurredAt} <= ${toDate}`
        )
      )
      .orderBy(attendanceEvents.occurredAt);
  }

  async reportManualAttendance(actor: AuthenticatedAccount, data: any, context: RequestContext) {
    try {
      return await this.database.transaction(async (tx) => {
        const idempotencyKey = data.idempotencyKey;
        // Idempotency check
        const [existingEvent] = await tx
          .select()
          .from(attendanceEvents)
          .where(and(eq(attendanceEvents.propertyId, actor.propertyId), eq(attendanceEvents.idempotencyKey, idempotencyKey)))
          .limit(1);

        if (existingEvent) {
          if (existingEvent.staffId !== data.staffId || existingEvent.movement !== data.movement) {
            throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
          }
          return existingEvent;
        }

        const occurredDate = new Date(data.occurredAt);
        const now = new Date();
        if (Math.abs(now.getTime() - occurredDate.getTime()) > 24 * 60 * 60 * 1000) {
          throw new BadRequestException('La hora del evento está fuera del margen permitido (+/- 24h)');
        }

        // Validate staff belongs to property
        const [staffMember] = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.id, data.staffId), eq(staff.propertyId, actor.propertyId)))
          .limit(1);

        if (!staffMember) {
          throw new NotFoundException('Personal no encontrado');
        }

        // Link to shift instance
        const margin = 2 * 60 * 60 * 1000;
        const dayBefore = new Date(occurredDate.getTime() - 24 * 60 * 60 * 1000);
        const dayAfter = new Date(occurredDate.getTime() + 24 * 60 * 60 * 1000);

        const candidateShifts = await tx.select().from(shiftInstances)
          .where(and(
            eq(shiftInstances.propertyId, actor.propertyId),
            eq(shiftInstances.staffId, data.staffId),
            eq(shiftInstances.status, 'Programado'),
            sql`${shiftInstances.plannedStartAt} >= ${dayBefore}`,
            sql`${shiftInstances.plannedStartAt} <= ${dayAfter}`
          ));

        let shiftInstanceId = null;
        for (const shift of candidateShifts) {
          const startDiff = Math.abs(shift.plannedStartAt.getTime() - occurredDate.getTime());
          const endDiff = Math.abs(shift.plannedEndAt.getTime() - occurredDate.getTime());

          if (data.movement === 'Ingreso' && startDiff <= margin) {
            shiftInstanceId = shift.id;
            break;
          } else if (data.movement === 'Salida' && endDiff <= margin) {
            shiftInstanceId = shift.id;
            break;
          }
        }

        const [event] = await tx
          .insert(attendanceEvents)
          .values({
            propertyId: actor.propertyId,
            staffId: data.staffId,
            shiftInstanceId,
            movement: data.movement,
            method: 'Manual',
            status: 'Completado',
            occurredAt: data.occurredAt,
            idempotencyKey,
            metadata: { reason: data.reason },
          })
          .returning();

        if (!event) {
          throw new BadRequestException('Failed to create attendance event');
        }

        await this.audit.record({
          ...this.auditBase(actor, context),
          eventType: 'attendance.manual.reported',
          subjectType: 'attendance_event',
          subjectId: event.id,
          metadata: { staffId: data.staffId, movement: data.movement },
        }, tx as any);

        return event;
      });
    } catch (error: any) {
      if (error?.code === '23505' && error?.constraint === 'attendance_events_idempotency_unique') {
        const [existing] = await this.database.select().from(attendanceEvents).where(and(eq(attendanceEvents.propertyId, actor.propertyId), eq(attendanceEvents.idempotencyKey, data.idempotencyKey))).limit(1);
        if (existing && (existing.staffId !== data.staffId || existing.movement !== data.movement)) {
          throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        }
        if (existing) return existing;
      }
      throw error;
    }
  }

  async reportBiometricAttendance(actor: AuthenticatedAccount, data: any, context: RequestContext) {
    const idempotencyKey = data.idempotencyKey || data.bridgeOperationId;
    try {
      return await this.database.transaction(async (tx) => {
        // Idempotency check
        const [existingEvent] = await tx
          .select()
          .from(attendanceEvents)
          .where(and(eq(attendanceEvents.propertyId, actor.propertyId), eq(attendanceEvents.idempotencyKey, idempotencyKey)))
          .limit(1);

        if (existingEvent) {
          if (existingEvent.staffId !== data.staffId || existingEvent.movement !== data.movement) {
            throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
          }
          return existingEvent;
        }

        const occurredDate = new Date(data.occurredAt);
        const now = new Date();
        if (Math.abs(now.getTime() - occurredDate.getTime()) > 24 * 60 * 60 * 1000) {
          throw new BadRequestException('La hora del evento está fuera del margen permitido (+/- 24h)');
        }

        // Validate staff belongs to property
        const [staffMember] = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.id, data.staffId), eq(staff.propertyId, actor.propertyId)))
          .limit(1);

        if (!staffMember) {
          throw new NotFoundException('Personal no encontrado');
        }

        // Validate device and binding
        const [device] = await tx
          .select({ id: schema.attendanceDevices.id })
          .from(schema.attendanceDevices)
          .where(and(eq(schema.attendanceDevices.id, data.deviceId), eq(schema.attendanceDevices.propertyId, actor.propertyId), eq(schema.attendanceDevices.status, 'Activo')))
          .limit(1);

        if (!device) {
          throw new BadRequestException('Dispositivo no encontrado o inactivo en esta propiedad');
        }

        const [binding] = await tx
          .select({ id: schema.staffBiometricBindings.id, templateReference: schema.staffBiometricBindings.templateReference })
          .from(schema.staffBiometricBindings)
          .where(and(
            eq(schema.staffBiometricBindings.staffId, data.staffId),
            eq(schema.staffBiometricBindings.deviceId, data.deviceId),
            eq(schema.staffBiometricBindings.status, 'Activo')
          ))
          .limit(1);

        if (!binding || binding.templateReference !== data.templateReference) {
          throw new BadRequestException('Huella no coincide o el personal no está enrolado en este dispositivo');
        }

        // Link to shift instance
        const margin = 2 * 60 * 60 * 1000;
        const dayBefore = new Date(occurredDate.getTime() - 24 * 60 * 60 * 1000);
        const dayAfter = new Date(occurredDate.getTime() + 24 * 60 * 60 * 1000);

        const candidateShifts = await tx.select().from(schema.shiftInstances)
          .where(and(
            eq(schema.shiftInstances.propertyId, actor.propertyId),
            eq(schema.shiftInstances.staffId, data.staffId),
            eq(schema.shiftInstances.status, 'Programado'),
            sql`${schema.shiftInstances.plannedStartAt} >= ${dayBefore}`,
            sql`${schema.shiftInstances.plannedStartAt} <= ${dayAfter}`
          ));

        let shiftInstanceId = null;
        for (const shift of candidateShifts) {
          const startDiff = Math.abs(shift.plannedStartAt.getTime() - occurredDate.getTime());
          const endDiff = Math.abs(shift.plannedEndAt.getTime() - occurredDate.getTime());

          if (data.movement === 'Ingreso' && startDiff <= margin) {
            shiftInstanceId = shift.id;
            break;
          } else if (data.movement === 'Salida' && endDiff <= margin) {
            shiftInstanceId = shift.id;
            break;
          }
        }

        const [event] = await tx
          .insert(attendanceEvents)
          .values({
            propertyId: actor.propertyId,
            staffId: data.staffId,
            deviceId: data.deviceId,
            shiftInstanceId,
            movement: data.movement,
            method: 'Biométrico',
            status: 'Completado',
            occurredAt: data.occurredAt,
            bridgeOperationId: data.bridgeOperationId,
            idempotencyKey: idempotencyKey,
            metadata: { templateReference: data.templateReference },
          })
          .returning();

        if (!event) {
          throw new BadRequestException('Failed to create biometric attendance event');
        }

        await this.audit.record({
          ...this.auditBase(actor, context),
          eventType: 'attendance.biometric.reported',
          subjectType: 'attendance_event',
          subjectId: event.id,
          metadata: { staffId: data.staffId, movement: data.movement, deviceId: data.deviceId },
        }, tx as any);

        return event;
      });
    } catch (error: any) {
      if (error?.code === '23505' && error?.constraint === 'attendance_events_idempotency_unique') {
        const [existing] = await this.database.select().from(attendanceEvents).where(and(eq(attendanceEvents.propertyId, actor.propertyId), eq(attendanceEvents.idempotencyKey, idempotencyKey))).limit(1);
        if (existing && (existing.staffId !== data.staffId || existing.movement !== data.movement)) {
          throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        }
        if (existing) return existing;
      }
      throw error;
    }
  }

  async submitCorrection(actor: AuthenticatedAccount, data: any, context: RequestContext) {
    return this.database.transaction(async (tx) => {
      // Validate event exists and belongs to property
      const [event] = await tx
        .select({ id: attendanceEvents.id })
        .from(attendanceEvents)
        .where(and(eq(attendanceEvents.id, data.attendanceEventId), eq(attendanceEvents.propertyId, actor.propertyId)))
        .limit(1);

      if (!event) {
        throw new NotFoundException('Evento de asistencia no encontrado');
      }

      const [correction] = await tx
        .insert(attendanceCorrections)
        .values({
          attendanceEventId: data.attendanceEventId,
          correctionType: data.correctionType,
          proposedValues: data.proposedValues,
          reason: data.reason,
          requesterAccountId: actor.accountId,
          status: 'Solicitado',
        })
        .returning();

      await this.audit.record({
        ...this.auditBase(actor, context),
        eventType: 'attendance.correction.submitted',
        subjectType: 'attendance_correction',
        subjectId: correction!.id,
        metadata: { eventId: data.attendanceEventId, type: data.correctionType },
      }, tx as any);

      return correction;
    });
  }

  async decideCorrection(correctionId: string, actor: AuthenticatedAccount, data: any, context: RequestContext) {
    return this.database.transaction(async (tx) => {
      const [correction] = await tx
        .select({ id: attendanceCorrections.id, status: attendanceCorrections.status, attendanceEventId: attendanceCorrections.attendanceEventId })
        .from(attendanceCorrections)
        .innerJoin(attendanceEvents, eq(attendanceCorrections.attendanceEventId, attendanceEvents.id))
        .where(and(eq(attendanceCorrections.id, correctionId), eq(attendanceEvents.propertyId, actor.propertyId)))
        .limit(1);

      if (!correction) {
        throw new NotFoundException('Corrección no encontrada');
      }

      if (correction.status !== 'Solicitado') {
        throw new ConflictException('La corrección ya fue decidida');
      }

      const newStatus = data.approved ? 'Aprobado' : 'Rechazado';

      const [updated] = await tx
        .update(attendanceCorrections)
        .set({
          status: newStatus,
          approverAccountId: actor.accountId,
          decidedAt: new Date(),
        })
        .where(eq(attendanceCorrections.id, correctionId))
        .returning();

      // IMPORTANT: If approved, we could potentially apply the correction here, but unit 5 says "sin modificar los eventos originales."
      // The frontend must merge events with approved corrections or use a view. The plan: "No editar ni borrar attendance_events."

      await this.audit.record({
        ...this.auditBase(actor, context),
        eventType: `attendance.correction.${data.approved ? 'approved' : 'rejected'}`,
        subjectType: 'attendance_correction',
        subjectId: correctionId,
        metadata: { eventId: correction.attendanceEventId, notes: data.notes },
      }, tx as any);

      return updated;
    });
  }

  getKioskQrToken(propertyId: string) {
    return this.dynamicQrService.generateKioskToken(propertyId, 20);
  }

  async reportQrAttendance(actor: AuthenticatedAccount, data: any, context: RequestContext) {
    // 1. Verify and consume QR token
    const tokenResult = this.dynamicQrService.verifyAndConsumeToken(data.qrToken, actor.propertyId);

    // 2. Fetch property coordinates & geofence radius
    const [property] = await this.database
      .select({
        id: schema.properties.id,
        latitude: schema.properties.latitude,
        longitude: schema.properties.longitude,
        geofenceRadiusMeters: schema.properties.geofenceRadiusMeters,
      })
      .from(schema.properties)
      .where(eq(schema.properties.id, actor.propertyId))
      .limit(1);

    // Default to Park Plaza hotel coordinates if not set in DB
    const hotelLat = property?.latitude ? Number(property.latitude) : -12.0968;
    const hotelLon = property?.longitude ? Number(property.longitude) : -77.0353;
    const hotelRadius = property?.geofenceRadiusMeters || 80;

    // 3. Validate geofence with Haversine formula
    const geoResult = this.geofenceService.validateGeofence(
      hotelLat,
      hotelLon,
      hotelRadius,
      data.latitude,
      data.longitude,
      data.accuracy ?? 10
    );

    if (!geoResult.isValid) {
      throw new BadRequestException(geoResult.message);
    }

    return await this.database.transaction(async (tx) => {
      const idempotencyKey = data.idempotencyKey;

      // Idempotency check
      const [existingEvent] = await tx
        .select()
        .from(attendanceEvents)
        .where(and(eq(attendanceEvents.propertyId, actor.propertyId), eq(attendanceEvents.idempotencyKey, idempotencyKey)))
        .limit(1);

      if (existingEvent) {
        return existingEvent;
      }

      // Resolve staffId
      let targetStaffId = data.staffId;
      if (!targetStaffId) {
        const [matchedStaff] = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.accountId, actor.accountId), eq(staff.propertyId, actor.propertyId)))
          .limit(1);
        targetStaffId = matchedStaff?.id;
      }

      if (!targetStaffId) {
        // Fallback: check if there is staff in property
        const [anyStaff] = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.propertyId, actor.propertyId))
          .limit(1);
        targetStaffId = anyStaff?.id;
      }

      if (!targetStaffId) {
        throw new NotFoundException('No se encontró el colaborador correspondiente en esta propiedad.');
      }

      // 4. Anti-double punch: prevent multiple events in less than 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const [recentEvent] = await tx
        .select({ id: attendanceEvents.id, movement: attendanceEvents.movement, occurredAt: attendanceEvents.occurredAt })
        .from(attendanceEvents)
        .where(and(
          eq(attendanceEvents.propertyId, actor.propertyId),
          eq(attendanceEvents.staffId, targetStaffId),
          sql`${attendanceEvents.occurredAt} >= ${twoMinutesAgo}`
        ))
        .limit(1);

      if (recentEvent) {
        throw new BadRequestException(`Ya registraste tu ${recentEvent.movement.toLowerCase()} hace un momento. Por favor esperá 2 minutos.`);
      }

      // 5. Auto-detect movement if not explicitly provided
      let movement = data.movement;
      if (!movement) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [lastTodayEvent] = await tx
          .select({ movement: attendanceEvents.movement })
          .from(attendanceEvents)
          .where(and(
            eq(attendanceEvents.propertyId, actor.propertyId),
            eq(attendanceEvents.staffId, targetStaffId),
            sql`${attendanceEvents.occurredAt} >= ${startOfDay}`
          ))
          .orderBy(sql`${attendanceEvents.occurredAt} DESC`)
          .limit(1);

        movement = lastTodayEvent?.movement === 'Ingreso' ? 'Salida' : 'Ingreso';
      }

      // 6. Link to shift instance
      const occurredDate = new Date();
      const margin = 2 * 60 * 60 * 1000;
      const dayBefore = new Date(occurredDate.getTime() - 24 * 60 * 60 * 1000);
      const dayAfter = new Date(occurredDate.getTime() + 24 * 60 * 60 * 1000);

      const candidateShifts = await tx.select().from(shiftInstances)
        .where(and(
          eq(shiftInstances.propertyId, actor.propertyId),
          eq(shiftInstances.staffId, targetStaffId),
          eq(shiftInstances.status, 'Programado'),
          sql`${shiftInstances.plannedStartAt} >= ${dayBefore}`,
          sql`${shiftInstances.plannedStartAt} <= ${dayAfter}`
        ));

      let shiftInstanceId = null;
      for (const shift of candidateShifts) {
        const startDiff = Math.abs(shift.plannedStartAt.getTime() - occurredDate.getTime());
        const endDiff = Math.abs(shift.plannedEndAt.getTime() - occurredDate.getTime());

        if (movement === 'Ingreso' && startDiff <= margin) {
          shiftInstanceId = shift.id;
          break;
        } else if (movement === 'Salida' && endDiff <= margin) {
          shiftInstanceId = shift.id;
          break;
        }
      }

      // 7. Insert attendance event with QR_GPS method and geofence metadata
      const [event] = await tx
        .insert(attendanceEvents)
        .values({
          propertyId: actor.propertyId,
          staffId: targetStaffId,
          shiftInstanceId,
          movement,
          method: 'QR_GPS',
          status: 'Completado',
          occurredAt: occurredDate,
          idempotencyKey,
          metadata: {
            verification: 'QR_GPS',
            distanceMeters: geoResult.distanceMeters,
            allowedRadiusMeters: geoResult.allowedRadiusMeters,
            coordinates: {
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: data.accuracy ?? 10,
            },
            qrTimestamp: tokenResult.timestamp.toISOString(),
            ipAddress: context.ipAddress,
          },
        })
        .returning();

      if (!event) {
        throw new BadRequestException('Error al registrar el evento de asistencia QR.');
      }

      await this.audit.record({
        ...this.auditBase(actor, context),
        eventType: 'attendance.qr_gps.reported',
        subjectType: 'attendance_event',
        subjectId: event.id,
        metadata: { staffId: targetStaffId, movement, distanceMeters: geoResult.distanceMeters },
      }, tx as any);

      return {
        ...event,
        distanceMeters: geoResult.distanceMeters,
        detectedMovement: movement,
      };
    });
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
