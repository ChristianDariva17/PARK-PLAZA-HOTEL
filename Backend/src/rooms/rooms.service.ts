import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { getPostgresErrorFields } from '../database/postgres-error.js';
import { accounts, auditEvents, roomCategories, roomCategoryAmenities, rooms } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import type { BlockRoomDto, UpdateCategoryAmenitiesDto, UpdateCategoryDto, UpdateRoomDto } from './rooms.dto.js';
import { MASTER_ROOM_AMENITIES } from './rooms-amenities.catalog.js';

const categorySelection = {
  id: roomCategories.id,
  code: roomCategories.code,
  name: roomCategories.name,
  capacity: roomCategories.capacity,
  baseNightlyRate: roomCategories.baseNightlyRate,
  createdAt: roomCategories.createdAt,
};

const roomSelection = {
  id: rooms.id,
  number: rooms.number,
  floor: rooms.floor,
  status: rooms.status,
  createdAt: rooms.createdAt,
  categoryId: roomCategories.id,
  categoryCode: roomCategories.code,
  categoryName: roomCategories.name,
  categoryCapacity: roomCategories.capacity,
  categoryBaseNightlyRate: roomCategories.baseNightlyRate,
  categoryCreatedAt: roomCategories.createdAt,
};

const roomReturning = {
  id: rooms.id,
  number: rooms.number,
  floor: rooms.floor,
  status: rooms.status,
  createdAt: rooms.createdAt,
};

type RoomStatus = typeof rooms.$inferSelect.status;
type CategoryRow = typeof roomCategories.$inferSelect;
type CategoryProjection = Pick<CategoryRow, 'id' | 'code' | 'name' | 'capacity' | 'baseNightlyRate' | 'createdAt'>;
type RoomJoinedRow = {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  createdAt: Date;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  categoryCapacity: number;
  categoryBaseNightlyRate: string;
  categoryCreatedAt: Date;
};

export interface RoomCategoryResponse {
  id: string;
  code: string;
  name: string;
  capacity: number;
  baseNightlyRate: string;
  createdAt: string;
}

export interface RoomResponse {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  createdAt: string;
  category: RoomCategoryResponse;
}

@Injectable()
export class RoomsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(propertyId: string): Promise<{ rooms: RoomResponse[]; categories: RoomCategoryResponse[] }> {
    const [categoryRows, roomRows] = await Promise.all([
      this.database.select(categorySelection).from(roomCategories).where(eq(roomCategories.propertyId, propertyId))
        .orderBy(asc(roomCategories.name), asc(roomCategories.code), asc(roomCategories.id)),
      this.database.select(roomSelection).from(rooms).innerJoin(
        roomCategories,
        and(eq(rooms.categoryId, roomCategories.id), eq(rooms.propertyId, roomCategories.propertyId)),
      ).where(eq(rooms.propertyId, propertyId)).orderBy(asc(rooms.floor), asc(rooms.number), asc(rooms.id)),
    ]);
    return { categories: categoryRows.map((row) => this.toCategoryResponse(row)), rooms: roomRows.map((row) => this.toRoomResponse(row)) };
  }

  async listCategories(propertyId: string): Promise<RoomCategoryResponse[]> {
    const rows = await this.database.select(categorySelection).from(roomCategories)
      .where(eq(roomCategories.propertyId, propertyId))
      .orderBy(asc(roomCategories.name), asc(roomCategories.code), asc(roomCategories.id));
    return rows.map((row) => this.toCategoryResponse(row));
  }

  async update(actor: AuthenticatedAccount, roomId: string, input: UpdateRoomDto, context: RequestContext): Promise<RoomResponse> {
    try {
      const response = await this.database.transaction(async (tx) => {
        await acquirePropertyTransactionLock(tx, actor.propertyId);
        const currentRows = await tx.select(roomSelection).from(rooms).innerJoin(
          roomCategories,
          and(eq(rooms.categoryId, roomCategories.id), eq(rooms.propertyId, roomCategories.propertyId)),
        ).where(and(eq(rooms.id, roomId), eq(rooms.propertyId, actor.propertyId))).limit(1).for('update');
        const current = currentRows[0];
        if (!current) throw new NotFoundException('Room not found');

        let category = this.categoryFromRoom(current);
        if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
          const categoryRows = await tx.select(categorySelection).from(roomCategories)
            .where(and(eq(roomCategories.id, input.categoryId), eq(roomCategories.propertyId, actor.propertyId))).limit(1);
          if (!categoryRows[0]) throw new NotFoundException('Room category not found');
          category = categoryRows[0];
        }

        const changes: Partial<Pick<typeof rooms.$inferInsert, 'number' | 'floor' | 'categoryId'>> = {};
        if (input.number !== undefined && input.number !== current.number) changes.number = input.number;
        if (input.floor !== undefined && input.floor !== current.floor) changes.floor = input.floor;
        if (input.categoryId !== undefined && input.categoryId !== current.categoryId) changes.categoryId = input.categoryId;
        const changedFields = Object.keys(changes);
        if (changedFields.length === 0) return this.toRoomResponse(current);

        const updatedRows = await tx.update(rooms).set(changes)
          .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, actor.propertyId))).returning(roomReturning);
        const updated = updatedRows[0];
        if (!updated) throw new NotFoundException('Room not found');
        await this.audit.record({
          ...this.auditBase(actor, context), eventType: 'room.updated', subjectType: 'room', subjectId: roomId,
          metadata: { fields: changedFields },
        }, tx);
        return this.toRoomResponse({
          ...updated,
          categoryId: category.id,
          categoryCode: category.code,
          categoryName: category.name,
          categoryCapacity: category.capacity,
          categoryBaseNightlyRate: category.baseNightlyRate,
          categoryCreatedAt: category.createdAt,
        });
      });

      this.realtime.emitToProperty(actor.propertyId, 'room:updated', response);
      return response;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async updateCategory(actor: AuthenticatedAccount, categoryId: string, input: UpdateCategoryDto, context: RequestContext): Promise<RoomCategoryResponse> {
    try {
      const updated = await this.database.transaction(async (tx) => {
        await acquirePropertyTransactionLock(tx, actor.propertyId);
        const currentRows = await tx.select(categorySelection).from(roomCategories)
          .where(and(eq(roomCategories.id, categoryId), eq(roomCategories.propertyId, actor.propertyId))).limit(1).for('update');
        const current = currentRows[0];
        if (!current) throw new NotFoundException('Room category not found');

        const changes: Partial<Pick<typeof roomCategories.$inferInsert, 'name' | 'code' | 'capacity' | 'baseNightlyRate'>> = {};
        if (input.name !== undefined && input.name !== current.name) changes.name = input.name;
        if (input.code !== undefined && input.code !== current.code) changes.code = input.code;
        if (input.capacity !== undefined && input.capacity !== current.capacity) changes.capacity = input.capacity;
        if (input.baseNightlyRate !== undefined && input.baseNightlyRate !== current.baseNightlyRate) changes.baseNightlyRate = input.baseNightlyRate;
        const changedFields = Object.keys(changes);
        if (changedFields.length === 0) return this.toCategoryResponse(current);

        const updatedRows = await tx.update(roomCategories).set(changes)
          .where(and(eq(roomCategories.id, categoryId), eq(roomCategories.propertyId, actor.propertyId))).returning(categorySelection);
        const saved = updatedRows[0];
        if (!saved) throw new NotFoundException('Room category not found');

        await this.audit.record({
          ...this.auditBase(actor, context), eventType: 'room_category.updated', subjectType: 'room_category', subjectId: categoryId,
          metadata: { fields: changedFields, changes },
        }, tx);
        return this.toCategoryResponse(saved);
      });

      const allCategories = await this.listCategories(actor.propertyId);
      this.realtime.emitToProperty(actor.propertyId, 'room:category_updated', {
        category: updated,
        categories: allCategories,
      });

      return updated;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async listAmenities(propertyId: string) {
    const rows = await this.database.select({
      categoryId: roomCategoryAmenities.categoryId,
      amenityKey: roomCategoryAmenities.amenityKey,
    })
    .from(roomCategoryAmenities)
    .where(eq(roomCategoryAmenities.propertyId, propertyId));

    const categoryMap: Record<string, string[]> = {};
    for (const row of rows) {
      const list = categoryMap[row.categoryId] ?? [];
      list.push(row.amenityKey);
      categoryMap[row.categoryId] = list;
    }

    return {
      master: MASTER_ROOM_AMENITIES,
      categoryAmenities: categoryMap,
    };
  }

  async getCategoryAmenities(propertyId: string, categoryId: string): Promise<string[]> {
    const rows = await this.database.select({
      amenityKey: roomCategoryAmenities.amenityKey,
    })
    .from(roomCategoryAmenities)
    .where(and(
      eq(roomCategoryAmenities.propertyId, propertyId),
      eq(roomCategoryAmenities.categoryId, categoryId),
    ));

    return rows.map((r) => r.amenityKey);
  }

  async updateCategoryAmenities(
    actor: AuthenticatedAccount,
    categoryId: string,
    amenityKeys: string[],
    context: RequestContext,
  ) {
    await this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const cat = await tx.select({ id: roomCategories.id, name: roomCategories.name }).from(roomCategories)
        .where(and(eq(roomCategories.id, categoryId), eq(roomCategories.propertyId, actor.propertyId))).limit(1);
      if (!cat[0]) throw new NotFoundException('Room category not found');

      await tx.delete(roomCategoryAmenities).where(and(
        eq(roomCategoryAmenities.propertyId, actor.propertyId),
        eq(roomCategoryAmenities.categoryId, categoryId),
      ));

      const uniqueKeys = Array.from(new Set(amenityKeys));
      if (uniqueKeys.length > 0) {
        await tx.insert(roomCategoryAmenities).values(
          uniqueKeys.map((key) => ({
            propertyId: actor.propertyId,
            categoryId,
            amenityKey: key,
          })),
        );
      }

      await this.audit.record({
        ...this.auditBase(actor, context),
        eventType: 'room_category_amenities.updated',
        subjectType: 'room_category',
        subjectId: categoryId,
        metadata: { categoryName: cat[0].name, amenitiesCount: uniqueKeys.length, amenityKeys: uniqueKeys },
      }, tx);
    });

    const allData = await this.listAmenities(actor.propertyId);
    this.realtime.emitToProperty(actor.propertyId, 'room:amenities_updated', {
      categoryId,
      amenityKeys,
      ...allData,
    });

    return { success: true, categoryId, amenityKeys };
  }

  async getCategoryAuditHistory(propertyId: string, categoryId: string) {
    const rows = await (this.database as any).select({
      id: auditEvents.id,
      occurredAt: auditEvents.occurredAt,
      eventType: auditEvents.eventType,
      metadata: auditEvents.metadata,
      actorEmail: accounts.email,
    })
    .from(auditEvents)
    .leftJoin(accounts, eq(auditEvents.actorAccountId, accounts.id))
    .where(and(
      eq(auditEvents.propertyId, propertyId),
      eq(auditEvents.subjectType, 'room_category'),
      eq(auditEvents.subjectId, categoryId),
    ))
    .orderBy(desc(auditEvents.occurredAt))
    .limit(15);

    return rows.map((r: any) => ({
      id: r.id,
      occurredAt: r.occurredAt.toISOString(),
      eventType: r.eventType,
      metadata: r.metadata,
      actorEmail: r.actorEmail || 'Administrador',
    }));
  }

  async setBlocked(actor: AuthenticatedAccount, roomId: string, input: BlockRoomDto, context: RequestContext): Promise<RoomResponse> {
    const response = await this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      const currentRows = await tx.select(roomSelection).from(rooms).innerJoin(
        roomCategories,
        and(eq(rooms.categoryId, roomCategories.id), eq(rooms.propertyId, roomCategories.propertyId)),
      ).where(and(eq(rooms.id, roomId), eq(rooms.propertyId, actor.propertyId))).limit(1).for('update');
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Room not found');
      const target: RoomStatus = input.blocked ? 'blocked' : 'available';
      if (current.status === target) return this.toRoomResponse(current);
      const expected: RoomStatus = input.blocked ? 'available' : 'blocked';
      if (current.status !== expected) throw new ConflictException('Room status does not allow this transition');

      const updatedRows = await tx.update(rooms).set({ status: target })
        .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, actor.propertyId))).returning(roomReturning);
      const updated = updatedRows[0];
      if (!updated) throw new NotFoundException('Room not found');
      await this.audit.record({
        ...this.auditBase(actor, context), eventType: input.blocked ? 'room.blocked' : 'room.unblocked', subjectType: 'room', subjectId: roomId,
        metadata: { reason: input.reason, previousStatus: current.status, nextStatus: target },
      }, tx);
      return this.toRoomResponse({ ...current, ...updated });
    });

    this.realtime.emitToProperty(actor.propertyId, 'room:status_changed', response);
    this.realtime.emitToProperty(actor.propertyId, 'room:updated', response);
    return response;
  }

  private categoryFromRoom(row: RoomJoinedRow): CategoryProjection {
    return {
      id: row.categoryId,
      code: row.categoryCode,
      name: row.categoryName,
      capacity: row.categoryCapacity,
      baseNightlyRate: row.categoryBaseNightlyRate,
      createdAt: row.categoryCreatedAt,
    };
  }

  private toCategoryResponse(row: CategoryProjection): RoomCategoryResponse {
    return { id: row.id, code: row.code, name: row.name, capacity: row.capacity, baseNightlyRate: row.baseNightlyRate, createdAt: row.createdAt.toISOString() };
  }

  private toRoomResponse(row: RoomJoinedRow): RoomResponse {
    return {
      id: row.id, number: row.number, floor: row.floor, status: row.status, createdAt: row.createdAt.toISOString(),
      category: this.toCategoryResponse({ id: row.categoryId, code: row.categoryCode, name: row.categoryName, capacity: row.categoryCapacity, baseNightlyRate: row.categoryBaseNightlyRate, createdAt: row.categoryCreatedAt }),
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

  private rethrowConstraint(error: unknown): never {
    const postgresError = getPostgresErrorFields(error);
    if (postgresError?.code === '23505' && postgresError.constraint === 'rooms_property_id_number_key') {
      throw new ConflictException('Room number is already in use');
    }
    if (postgresError?.code === '23505' && (postgresError.constraint?.includes('code') || postgresError.constraint?.includes('room_categories'))) {
      throw new ConflictException('Room category code is already in use');
    }
    throw error;
  }
}
