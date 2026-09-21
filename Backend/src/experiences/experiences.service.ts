import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DATABASE, Database } from '../database/database.module.js';
import { experiences, experienceParticipations } from '../database/schema/experiences.schema.js';
import { auditEvents, accounts } from '../database/schema/security.schema.js';
import { guests } from '../database/schema/guests.schema.js';
import { stays, stayGuests } from '../database/schema/stays.schema.js';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { CreateExperienceDto, UpdateExperienceDto, CreateParticipationDto, ListExperiencesQueryDto } from './experiences.dto.js';
import { commandReceipts } from '../database/schema/commands.schema.js';
import { requestFingerprint } from '../database/idempotency.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';

export interface RequestContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ExperiencesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createExperience(propertyId: string, accountId: string, dto: CreateExperienceDto, ctx: RequestContext) {
    return await this.db.transaction(async (tx: any) => {
      await this.assertAccountBelongsToProperty(tx, accountId, propertyId);
      const [experience] = await tx.insert(experiences).values({
        propertyId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        maxCapacity: dto.maxCapacity,
        requiresReservation: dto.requiresReservation,
        price: dto.price.toString(),
        status: 'DRAFT'
      }).returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'experience.created',
        subjectType: 'experience',
        subjectId: experience.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent
      });

      return experience;
    });
  }

  async listExperiences(propertyId: string, query: ListExperiencesQueryDto) {
    const conditions = [eq(experiences.propertyId, propertyId)];
    
    if (query.status) {
      conditions.push(eq(experiences.status, query.status));
    }
    if (query.type) {
      conditions.push(eq(experiences.type, query.type));
    }

    return this.db.query.experiences.findMany({
      where: and(...conditions),
      orderBy: [desc(experiences.createdAt)]
    });
  }

  async updateExperience(propertyId: string, accountId: string, experienceId: string, dto: UpdateExperienceDto, ctx: RequestContext) {
    const exp = await this.db.query.experiences.findFirst({
      where: and(eq(experiences.propertyId, propertyId), eq(experiences.id, experienceId))
    });

    if (!exp) throw new NotFoundException('Experiencia no encontrada');

    return await this.db.transaction(async (tx: any) => {
      await this.assertAccountBelongsToProperty(tx, accountId, propertyId);
      const updateData: any = { updatedAt: new Date() };
      
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.maxCapacity !== undefined) updateData.maxCapacity = dto.maxCapacity;
      if (dto.requiresReservation !== undefined) updateData.requiresReservation = dto.requiresReservation;
      if (dto.price !== undefined) updateData.price = dto.price.toString();
      
      if (dto.status !== undefined) {
        updateData.status = dto.status;
        if (dto.status === 'PUBLISHED') {
          updateData.publishedBy = accountId;
        }
      }

      const [updated] = await tx.update(experiences)
        .set(updateData)
        .where(and(eq(experiences.id, experienceId), eq(experiences.propertyId, propertyId)))
        .returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'experience.updated',
        subjectType: 'experience',
        subjectId: experienceId,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { changes: Object.keys(updateData) }
      });

      return updated;
    });
  }

  async registerParticipation(propertyId: string, accountId: string, experienceId: string, dto: CreateParticipationDto, ctx: RequestContext) {
    return await this.db.transaction(async (tx: any) => {
      await acquirePropertyTransactionLock(tx, propertyId);
      await this.assertAccountBelongsToProperty(tx, accountId, propertyId);

      const receiptPayload = {
        accountId,
        experienceId,
        stayId: dto.stayId ?? null,
        guestId: dto.guestId ?? null,
        pax: dto.pax,
        scheduledAt: dto.scheduledAt ?? null,
      };
      const fingerprint = requestFingerprint(receiptPayload);
      const [existingReceipt] = await tx.select({ response: commandReceipts.response, requestFingerprint: commandReceipts.requestFingerprint })
        .from(commandReceipts)
        .where(and(
          eq(commandReceipts.propertyId, propertyId),
          eq(commandReceipts.operation, 'experiences.participation.register'),
          eq(commandReceipts.idempotencyKey, dto.idempotencyKey),
        ))
        .limit(1);
      if (existingReceipt) {
        if (existingReceipt.requestFingerprint !== fingerprint) throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        return existingReceipt.response;
      }

      const exp = await tx.query.experiences.findFirst({
        where: and(eq(experiences.propertyId, propertyId), eq(experiences.id, experienceId))
      });

      if (!exp) throw new NotFoundException('Experiencia no encontrada');
      if (exp.status !== 'PUBLISHED') throw new BadRequestException('La experiencia no está disponible');
      if (!dto.stayId && !dto.guestId) throw new BadRequestException('La participación debe vincularse a una estadía o huésped');

      if (dto.stayId) {
        const stay = await tx.query.stays.findFirst({
          where: and(eq(stays.id, dto.stayId), eq(stays.propertyId, propertyId)),
          columns: { id: true },
        });
        if (!stay) throw new NotFoundException('Estadía no encontrada');
      }

      if (dto.guestId) {
        const guest = await tx.query.guests.findFirst({
          where: and(eq(guests.id, dto.guestId), eq(guests.propertyId, propertyId)),
          columns: { id: true },
        });
        if (!guest) throw new NotFoundException('Huésped no encontrado');
      }

      if (dto.stayId && dto.guestId) {
        const stayGuest = await tx.query.stayGuests.findFirst({
          where: and(eq(stayGuests.stayId, dto.stayId), eq(stayGuests.guestId, dto.guestId), eq(stayGuests.propertyId, propertyId)),
          columns: { stayId: true },
        });
        if (!stayGuest) throw new BadRequestException('El huésped no pertenece a la estadía');
      }

      // Capacity is scoped to an exact scheduled slot; experiences have no duration model.
      if (exp.maxCapacity && dto.scheduledAt) {
        const currentCountRes = await tx.select({ totalPax: sql<number>`sum(pax)` })
          .from(experienceParticipations)
          .where(
            and(
              eq(experienceParticipations.experienceId, experienceId),
              eq(experienceParticipations.propertyId, propertyId),
              eq(experienceParticipations.scheduledAt, new Date(dto.scheduledAt)),
              or(
                eq(experienceParticipations.status, 'REQUESTED'),
                eq(experienceParticipations.status, 'CONFIRMED')
              )
            )
          );
        
        const currentCount = Number(currentCountRes[0]?.totalPax || 0);
        if (currentCount + dto.pax > exp.maxCapacity) {
          throw new ConflictException('Capacidad máxima superada para este horario');
        }
      }

      const [participation] = await tx.insert(experienceParticipations).values({
        propertyId,
        experienceId,
        stayId: dto.stayId,
        guestId: dto.guestId,
        pax: dto.pax,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: exp.requiresReservation ? 'REQUESTED' : 'CONFIRMED',
        idempotencyKey: dto.idempotencyKey,
        registeredBy: accountId
      }).returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'experience.participation_registered',
        subjectType: 'participation',
        subjectId: participation.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent
      });

      await tx.insert(commandReceipts).values({
        propertyId,
        operation: 'experiences.participation.register',
        idempotencyKey: dto.idempotencyKey,
        requestFingerprint: fingerprint,
        responseStatus: 200,
        response: participation,
      });

      return participation;
    });
  }

  async listParticipations(propertyId: string, experienceId: string) {
    const experience = await this.db.query.experiences.findFirst({
      where: and(eq(experiences.id, experienceId), eq(experiences.propertyId, propertyId)),
      columns: { id: true },
    });
    if (!experience) throw new NotFoundException('Experiencia no encontrada');

    return this.db.query.experienceParticipations.findMany({
      where: and(
        eq(experienceParticipations.propertyId, propertyId),
        eq(experienceParticipations.experienceId, experienceId)
      ),
      orderBy: [desc(experienceParticipations.scheduledAt)]
    });
  }

  private async assertAccountBelongsToProperty(tx: any, accountId: string, propertyId: string) {
    const account = await tx.query.accounts.findFirst({
      where: and(eq(accounts.id, accountId), eq(accounts.propertyId, propertyId)),
      columns: { id: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
  }
}
