import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DATABASE, Database } from '../database/database.module.js';
import { experiences, experienceParticipations } from '../database/schema/experiences.schema.js';
import { auditEvents } from '../database/schema/security.schema.js';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { CreateExperienceDto, UpdateExperienceDto, CreateParticipationDto, ListExperiencesQueryDto } from './experiences.dto.js';

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
        .where(eq(experiences.id, experienceId))
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
      const exp = await tx.query.experiences.findFirst({
        where: and(eq(experiences.propertyId, propertyId), eq(experiences.id, experienceId))
      });

      if (!exp) throw new NotFoundException('Experiencia no encontrada');
      if (exp.status !== 'PUBLISHED') throw new BadRequestException('La experiencia no está disponible');

      // Idempotency check
      const existing = await tx.query.experienceParticipations.findFirst({
        where: and(
          eq(experienceParticipations.propertyId, propertyId),
          eq(experienceParticipations.idempotencyKey, dto.idempotencyKey)
        )
      });

      if (existing) return existing;

      // Check capacity if applicable
      if (exp.maxCapacity && dto.scheduledAt) {
        // Find existing participations for the exact same time (simple logic, should use range)
        const currentCountRes = await tx.select({ totalPax: sql<number>`sum(pax)` })
          .from(experienceParticipations)
          .where(
            and(
              eq(experienceParticipations.experienceId, experienceId),
              eq(experienceParticipations.scheduledAt, new Date(dto.scheduledAt)),
              or(
                eq(experienceParticipations.status, 'REQUESTED'),
                eq(experienceParticipations.status, 'CONFIRMED')
              )
            )
          );
        
        const currentCount = currentCountRes[0]?.totalPax || 0;
        if (currentCount + dto.pax > exp.maxCapacity) {
          throw new BadRequestException('Capacidad máxima superada para este horario');
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

      return participation;
    });
  }

  async listParticipations(propertyId: string, experienceId: string) {
    return this.db.query.experienceParticipations.findMany({
      where: and(
        eq(experienceParticipations.propertyId, propertyId),
        eq(experienceParticipations.experienceId, experienceId)
      ),
      orderBy: [desc(experienceParticipations.scheduledAt)]
    });
  }
}
