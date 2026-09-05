import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { DATABASE, type Database } from '../database/database.module.js';
import {
  amenityReservations,
  amenityConfigs,
  amenityBlocks,
  orders,
  orderItems,
  cashSessions,
  cashMovements,
} from '../database/schema/index.js';
import { stays, stayGuests } from '../database/schema/stays.schema.js';
import { customerGuestIdentities } from '../database/schema/customer.schema.js';
import { eq, and, desc, or, inArray, gte, lte, gt } from 'drizzle-orm';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type { AuthenticatedCustomer } from '../customer/customer.types.js';
import type { AuthenticatedAccount } from '../auth/auth.types.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import type {
  CreateAmenityBlockDto,
  CreateManualAmenityPassDto,
  UpdateAmenityConfigDto,
} from './amenities.dto.js';

export interface AmenityRuleConfig {
  amenityKey: string;
  name: string;
  priceExternal: number;
  priceGuest: number;
  durationMinutes: number;
  maxPax: number;
  capacity: number;
  openingHour: string;
  closingHour: string;
  isActive: boolean;
}

const DEFAULT_CONFIG_PISCINA: AmenityRuleConfig = {
  amenityKey: 'piscina',
  name: 'Piscina',
  priceExternal: 50.0,
  priceGuest: 0.0,
  durationMinutes: 120,
  maxPax: 6,
  capacity: 24,
  openingHour: '08:00',
  closingHour: '20:00',
  isActive: true,
};

const DEFAULT_CONFIG_MIRADOR: AmenityRuleConfig = {
  amenityKey: 'mirador',
  name: 'Mirador',
  priceExternal: 30.0,
  priceGuest: 0.0,
  durationMinutes: 90,
  maxPax: 4,
  capacity: 12,
  openingHour: '09:00',
  closingHour: '22:00',
  isActive: true,
};

const DEFAULT_CONFIGS: Record<string, AmenityRuleConfig> = {
  piscina: DEFAULT_CONFIG_PISCINA,
  mirador: DEFAULT_CONFIG_MIRADOR,
};

@Injectable()
export class AmenitiesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  async getConfigs(propertyId: string): Promise<AmenityRuleConfig[]> {
    const rows = await this.db
      .select()
      .from(amenityConfigs)
      .where(eq(amenityConfigs.propertyId, propertyId));

    const configMap = new Map<string, AmenityRuleConfig>();
    for (const row of rows) {
      configMap.set(row.amenityKey.toLowerCase(), {
        amenityKey: row.amenityKey,
        name: row.name,
        priceExternal: Number(row.priceExternal),
        priceGuest: Number(row.priceGuest),
        durationMinutes: row.durationMinutes,
        maxPax: row.maxPax,
        capacity: row.capacity,
        openingHour: row.openingHour,
        closingHour: row.closingHour,
        isActive: row.isActive,
      });
    }

    return Object.keys(DEFAULT_CONFIGS).map((key) => {
      const fallback = DEFAULT_CONFIGS[key] || DEFAULT_CONFIG_PISCINA;
      return configMap.get(key) || { ...fallback };
    });
  }

  async updateConfig(actor: AuthenticatedAccount, dto: UpdateAmenityConfigDto): Promise<AmenityRuleConfig> {
    const key = dto.amenityKey.toLowerCase();
    const existing = (
      await this.db
        .select()
        .from(amenityConfigs)
        .where(
          and(
            eq(amenityConfigs.propertyId, actor.propertyId),
            eq(amenityConfigs.amenityKey, key),
          ),
        )
        .limit(1)
    )[0];

    const defaultConfig = DEFAULT_CONFIGS[key] || DEFAULT_CONFIG_PISCINA;

    const values = {
      propertyId: actor.propertyId,
      amenityKey: key,
      name: dto.name ?? existing?.name ?? defaultConfig.name,
      priceExternal: (dto.priceExternal !== undefined ? dto.priceExternal : existing ? Number(existing.priceExternal) : defaultConfig.priceExternal).toFixed(2),
      priceGuest: (dto.priceGuest !== undefined ? dto.priceGuest : existing ? Number(existing.priceGuest) : defaultConfig.priceGuest).toFixed(2),
      durationMinutes: dto.durationMinutes ?? existing?.durationMinutes ?? defaultConfig.durationMinutes,
      maxPax: dto.maxPax ?? existing?.maxPax ?? defaultConfig.maxPax,
      capacity: dto.capacity ?? existing?.capacity ?? defaultConfig.capacity,
      openingHour: dto.openingHour ?? existing?.openingHour ?? defaultConfig.openingHour,
      closingHour: dto.closingHour ?? existing?.closingHour ?? defaultConfig.closingHour,
      isActive: dto.isActive ?? existing?.isActive ?? defaultConfig.isActive,
      updatedAt: new Date(),
    };

    if (existing) {
      await this.db
        .update(amenityConfigs)
        .set(values)
        .where(eq(amenityConfigs.id, existing.id));
    } else {
      await this.db.insert(amenityConfigs).values(values);
    }

    const updatedConfig: AmenityRuleConfig = {
      amenityKey: key,
      name: values.name,
      priceExternal: Number(values.priceExternal),
      priceGuest: Number(values.priceGuest),
      durationMinutes: values.durationMinutes,
      maxPax: values.maxPax,
      capacity: values.capacity,
      openingHour: values.openingHour,
      closingHour: values.closingHour,
      isActive: values.isActive,
    };

    if (this.realtime) {
      this.realtime.emitToProperty(actor.propertyId, 'amenity:config_updated', updatedConfig);
    }

    return updatedConfig;
  }

  async getOccupancy(propertyId: string) {
    const configs = await this.getConfigs(propertyId);
    const now = new Date();

    const activeReservations = await this.db
      .select({
        id: amenityReservations.id,
        amenityType: amenityReservations.amenityType,
        pax: amenityReservations.pax,
        startTime: amenityReservations.startTime,
        endTime: amenityReservations.endTime,
        status: amenityReservations.status,
      })
      .from(amenityReservations)
      .where(
        and(
          eq(amenityReservations.propertyId, propertyId),
          lte(amenityReservations.startTime, now),
          gt(amenityReservations.endTime, now),
          or(
            eq(amenityReservations.status, 'confirmed'),
            eq(amenityReservations.status, 'checked_in'),
          ),
        ),
      );

    const occupancyByZone: Record<string, any> = {};

    for (const conf of configs) {
      const zoneKey = conf.amenityKey.toLowerCase();
      const zoneName = conf.name;
      const zoneRes = activeReservations.filter((r) => {
        const type = r.amenityType.toLowerCase();
        return type.includes(zoneKey) || type.includes(zoneName.toLowerCase());
      });

      const currentPax = zoneRes.reduce((sum, r) => sum + Number(r.pax || 1), 0);
      const capacity = conf.capacity || 20;
      const percent = Math.min(100, Math.round((currentPax / capacity) * 100));

      let stateBadge = 'Disponible';
      if (percent >= 100) stateBadge = 'Aforo Completo';
      else if (percent >= 85) stateBadge = 'Casi Lleno';
      else if (percent >= 50) stateBadge = 'Ocupación Media';

      occupancyByZone[zoneKey] = {
        key: zoneKey,
        name: conf.name,
        currentPax,
        capacity,
        occupancyPercentage: percent,
        availableSlots: Math.max(0, capacity - currentPax),
        stateBadge,
        priceExternal: conf.priceExternal,
        priceGuest: conf.priceGuest,
        activeReservationsCount: zoneRes.length,
      };
    }

    return occupancyByZone;
  }

  async createManualPass(actor: AuthenticatedAccount, dto: CreateManualAmenityPassDto) {
    const configs = await this.getConfigs(actor.propertyId);
    const normalizedKey = dto.amenityType.toLowerCase().includes('mirador') ? 'mirador' : 'piscina';
    const config = configs.find((c) => c.amenityKey === normalizedKey) || DEFAULT_CONFIG_PISCINA;

    const startTime = dto.startTime ? new Date(dto.startTime) : new Date();
    const durationMs = (config.durationMinutes || 120) * 60 * 1000;
    const endTime = new Date(startTime.getTime() + durationMs);

    // Calculate price based on guest vs external
    let finalPrice = dto.customPrice;
    if (finalPrice === undefined || finalPrice === null) {
      if (dto.stayId) {
        finalPrice = config.priceGuest;
      } else {
        finalPrice = config.priceExternal * (dto.pax || 1);
      }
    }

    const priceStr = Number(finalPrice || 0).toFixed(2);
    const paymentStatus = dto.paymentStatus || (Number(priceStr) === 0 ? 'paid' : 'pending');

    const [inserted] = await this.db
      .insert(amenityReservations)
      .values({
        propertyId: actor.propertyId,
        stayId: dto.stayId || null,
        amenityType: config.name,
        documentNumber: dto.documentNumber || null,
        customerName: dto.customerName.trim(),
        startTime,
        endTime,
        pax: dto.pax || 1,
        price: priceStr,
        paymentStatus,
        status: 'confirmed',
        checkedInAt: new Date(),
      })
      .returning();

    // If paid immediately in cash and cash session is open, record movement
    if (paymentStatus === 'paid' && dto.paymentMethod === 'Efectivo' && Number(priceStr) > 0 && inserted) {
      const openSession = (
        await this.db
          .select()
          .from(cashSessions)
          .where(
            and(
              eq(cashSessions.propertyId, actor.propertyId),
              eq(cashSessions.status, 'open'),
            ),
          )
          .limit(1)
      )[0];

      if (openSession) {
        await this.db.insert(cashMovements).values({
          propertyId: actor.propertyId,
          sessionId: openSession.id,
          type: 'Ingreso',
          amount: priceStr,
          concept: `Cobro entrada Pase de Día: ${config.name} (${dto.customerName})`,
          method: 'Efectivo',
          responsible: actor.email,
          referenceId: `amenity-${inserted.id}`,
        });
      }
    }

    if (this.realtime && inserted) {
      this.realtime.emitToProperty(actor.propertyId, 'amenity:reservation_created', inserted);
      const occupancy = await this.getOccupancy(actor.propertyId);
      this.realtime.emitToProperty(actor.propertyId, 'amenity:occupancy_changed', occupancy);
    }

    return inserted;
  }

  async checkInReservation(actor: AuthenticatedAccount, reservationId: string) {
    const [reservation] = await this.db
      .select()
      .from(amenityReservations)
      .where(
        and(
          eq(amenityReservations.id, reservationId),
          eq(amenityReservations.propertyId, actor.propertyId),
        ),
      );

    if (!reservation) throw new NotFoundException('Reserva no encontrada.');

    const [updated] = await this.db
      .update(amenityReservations)
      .set({
        status: 'checked_in',
        checkedInAt: new Date(),
      })
      .where(eq(amenityReservations.id, reservationId))
      .returning();

    if (this.realtime) {
      const occupancy = await this.getOccupancy(actor.propertyId);
      this.realtime.emitToProperty(actor.propertyId, 'amenity:occupancy_changed', occupancy);
    }

    return updated;
  }

  async createBlock(actor: AuthenticatedAccount, dto: CreateAmenityBlockDto) {
    const [block] = await this.db
      .insert(amenityBlocks)
      .values({
        propertyId: actor.propertyId,
        amenityKey: dto.amenityKey.toLowerCase(),
        reason: dto.reason,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      })
      .returning();

    if (this.realtime) {
      this.realtime.emitToProperty(actor.propertyId, 'amenity:block_created', block);
    }

    return block;
  }

  async listBlocks(propertyId: string) {
    return this.db
      .select()
      .from(amenityBlocks)
      .where(
        and(
          eq(amenityBlocks.propertyId, propertyId),
          gte(amenityBlocks.endTime, new Date()),
        ),
      )
      .orderBy(amenityBlocks.startTime);
  }

  async listReservations(actor: AuthenticatedCustomer) {
    return this.db.select({
      id: amenityReservations.id,
      propertyId: amenityReservations.propertyId,
      stayId: amenityReservations.stayId,
      customerAccountId: amenityReservations.customerAccountId,
      amenityType: amenityReservations.amenityType,
      documentNumber: amenityReservations.documentNumber,
      customerName: amenityReservations.customerName,
      startTime: amenityReservations.startTime,
      endTime: amenityReservations.endTime,
      pax: amenityReservations.pax,
      price: amenityReservations.price,
      paymentStatus: amenityReservations.paymentStatus,
      status: amenityReservations.status,
      checkedInAt: amenityReservations.checkedInAt,
      createdAt: amenityReservations.createdAt,
    })
    .from(amenityReservations)
    .leftJoin(stayGuests, and(eq(stayGuests.stayId, amenityReservations.stayId), eq(stayGuests.propertyId, actor.propertyId)))
    .leftJoin(customerGuestIdentities, and(eq(customerGuestIdentities.guestId, stayGuests.guestId), eq(customerGuestIdentities.propertyId, actor.propertyId)))
    .where(and(
      eq(amenityReservations.propertyId, actor.propertyId),
      or(
        eq(amenityReservations.customerAccountId, actor.customerAccountId),
        eq(customerGuestIdentities.customerAccountId, actor.customerAccountId),
      ),
    ))
    .orderBy(desc(amenityReservations.startTime));
  }

  async listPropertyReservations(propertyId: string) {
    const reservationsList = await this.db.select({
      id: amenityReservations.id,
      stayId: amenityReservations.stayId,
      customerAccountId: amenityReservations.customerAccountId,
      roomId: stays.roomId,
      amenityType: amenityReservations.amenityType,
      documentNumber: amenityReservations.documentNumber,
      customerName: amenityReservations.customerName,
      startTime: amenityReservations.startTime,
      endTime: amenityReservations.endTime,
      pax: amenityReservations.pax,
      price: amenityReservations.price,
      paymentStatus: amenityReservations.paymentStatus,
      status: amenityReservations.status,
      checkedInAt: amenityReservations.checkedInAt,
      createdAt: amenityReservations.createdAt,
    })
      .from(amenityReservations)
      .leftJoin(stays, eq(stays.id, amenityReservations.stayId))
      .where(eq(amenityReservations.propertyId, propertyId))
      .orderBy(desc(amenityReservations.startTime));

    if (!reservationsList.length) return [];

    const reservationIds = reservationsList.map((r) => r.id);
    const linkedOrders = await this.db.select({
      id: orders.id,
      amenityReservationId: orders.amenityReservationId,
      total: orders.total,
      status: orders.status,
    })
      .from(orders)
      .where(and(
        eq(orders.propertyId, propertyId),
        inArray(orders.amenityReservationId, reservationIds),
      ));

    return reservationsList.map((reservation) => {
      const activeOrders = linkedOrders.filter((o) => o.amenityReservationId === reservation.id && o.status !== 'Cancelado');
      const consumptionsTotal = activeOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const totalAmount = Number(reservation.price || 0) + consumptionsTotal;
      return {
        ...reservation,
        consumptionsTotal: consumptionsTotal.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        ordersCount: activeOrders.length,
      };
    });
  }

  async getReservationTab(propertyId: string, reservationId: string) {
    const [reservation] = await this.db.select()
      .from(amenityReservations)
      .where(and(
        eq(amenityReservations.id, reservationId),
        eq(amenityReservations.propertyId, propertyId),
      ));

    if (!reservation) throw new NotFoundException('Reserva de amenidad no encontrada.');

    const linkedOrders = await this.db.select()
      .from(orders)
      .where(and(
        eq(orders.propertyId, propertyId),
        eq(orders.amenityReservationId, reservationId),
      ))
      .orderBy(desc(orders.createdAt));

    let itemsList: any[] = [];
    if (linkedOrders.length) {
      itemsList = await this.db.select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, linkedOrders.map((o) => o.id)));
    }

    const ordersWithItems = linkedOrders.map((order) => ({
      ...order,
      items: itemsList.filter((i) => i.orderId === order.id),
    }));

    const activeOrders = linkedOrders.filter((o) => o.status !== 'Cancelado');
    const consumptionsTotal = activeOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const entryPrice = Number(reservation.price || 0);
    const totalAmount = entryPrice + consumptionsTotal;

    return {
      reservation,
      orders: ordersWithItems,
      entryPrice: entryPrice.toFixed(2),
      consumptionsTotal: consumptionsTotal.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      paymentStatus: reservation.paymentStatus,
    };
  }

  async updateReservationIdentity(actor: AuthenticatedAccount, reservationId: string, data: { documentNumber?: string; customerName?: string }) {
    const [reservation] = await this.db.select()
      .from(amenityReservations)
      .where(and(
        eq(amenityReservations.id, reservationId),
        eq(amenityReservations.propertyId, actor.propertyId),
      ));

    if (!reservation) throw new NotFoundException('Reserva de amenidad no encontrada.');

    const [updated] = await this.db.update(amenityReservations)
      .set({
        documentNumber: data.documentNumber !== undefined ? data.documentNumber.trim() : reservation.documentNumber,
        customerName: data.customerName !== undefined ? data.customerName.trim() : reservation.customerName,
      })
      .where(eq(amenityReservations.id, reservationId))
      .returning();

    return updated;
  }

  async settleReservation(actor: AuthenticatedAccount, reservationId: string, data: { paymentMethod: string; amount?: number; note?: string }) {
    return this.db.transaction(async (tx: any) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);

      const [reservation] = await tx.select()
        .from(amenityReservations)
        .where(and(
          eq(amenityReservations.id, reservationId),
          eq(amenityReservations.propertyId, actor.propertyId),
        ));

      if (!reservation) throw new NotFoundException('Reserva de amenidad no encontrada.');
      if (reservation.paymentStatus === 'paid') throw new ConflictException('La cuenta de esta reserva ya ha sido liquidada.');

      const linkedOrders = await tx.select()
        .from(orders)
        .where(and(
          eq(orders.propertyId, actor.propertyId),
          eq(orders.amenityReservationId, reservationId),
        ));

      const activeOrders = linkedOrders.filter((o: any) => o.status !== 'Cancelado');
      const consumptionsTotal = activeOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
      const entryPrice = Number(reservation.price || 0);
      const totalAmount = entryPrice + consumptionsTotal;
      const totalStr = totalAmount.toFixed(2);

      // Check open cash session if cash
      const openSession = (await tx.select().from(cashSessions)
        .where(and(eq(cashSessions.propertyId, actor.propertyId), eq(cashSessions.status, 'open')))
        .limit(1)
        .for('update', { of: cashSessions }))[0];

      if (data.paymentMethod === 'Efectivo' && !openSession) {
        throw new ConflictException('Se requiere una sesión de caja abierta para registrar pagos en efectivo.');
      }

      const [updated] = await tx.update(amenityReservations)
        .set({
          paymentStatus: 'paid',
        })
        .where(eq(amenityReservations.id, reservationId))
        .returning();

      if (linkedOrders.length) {
        await tx.update(orders)
          .set({ status: 'Pagado' })
          .where(and(
            eq(orders.propertyId, actor.propertyId),
            eq(orders.amenityReservationId, reservationId),
          ));
      }

      if (openSession && totalAmount > 0) {
        await tx.insert(cashMovements).values({
          propertyId: actor.propertyId,
          sessionId: openSession.id,
          type: 'Ingreso',
          amount: totalStr,
          concept: `Liquidación cuenta ${reservation.amenityType}: ${reservation.customerName || 'Cliente'} (Entrada + Consumos)`,
          method: data.paymentMethod || 'Efectivo',
          responsible: actor.email,
          referenceId: `settle-amenity-${reservation.id}`,
        });
      }

      if (this.realtime) {
        this.realtime.emitToProperty(actor.propertyId, 'amenity:reservation_settled', updated);
      }

      return {
        success: true,
        reservation: updated,
        totalSettled: totalStr,
        paymentMethod: data.paymentMethod,
      };
    });
  }

  async createReservation(actor: AuthenticatedCustomer, data: { amenityType: string; startTime: string; pax?: number }) {
    const configs = await this.getConfigs(actor.propertyId);
    const key = data.amenityType.toLowerCase().includes('mirador') ? 'mirador' : 'piscina';
    const config = configs.find((c) => c.amenityKey === key) || DEFAULT_CONFIG_PISCINA;

    if (!config.isActive) throw new BadRequestException(`La zona ${config.name} no se encuentra activa para reservas.`);

    const startTime = new Date(data.startTime);
    if (isNaN(startTime.getTime())) throw new BadRequestException('Formato de fecha inválido.');
    if (startTime < new Date()) throw new BadRequestException('No se puede reservar en el pasado.');

    const durationMs = config.durationMinutes * 60 * 1000;
    const endTime = new Date(startTime.getTime() + durationMs);

    const pax = Number(data.pax) || 1;
    if (pax < 1 || pax > config.maxPax) {
      throw new BadRequestException(`El número de personas debe estar entre 1 y ${config.maxPax}.`);
    }

    // Check capacity for time overlap
    const existing = await this.db.select({ pax: amenityReservations.pax })
      .from(amenityReservations)
      .where(and(
        eq(amenityReservations.propertyId, actor.propertyId),
        eq(amenityReservations.amenityType, config.name),
        eq(amenityReservations.status, 'confirmed'),
        gte(amenityReservations.endTime, startTime),
        lte(amenityReservations.startTime, endTime),
      ));

    const currentTotalPax = existing.reduce((sum, r) => sum + (r.pax || 1), 0);
    if (currentTotalPax + pax > config.capacity) {
      throw new ConflictException(`Aforo completo para el horario seleccionado. Capacidad disponible: ${Math.max(0, config.capacity - currentTotalPax)} personas.`);
    }

    // Guest price
    const priceStr = Number(config.priceGuest || 0).toFixed(2);
    const paymentStatus = Number(priceStr) === 0 ? 'paid' : 'pending';

    const [inserted] = await this.db.insert(amenityReservations).values({
      propertyId: actor.propertyId,
      customerAccountId: actor.customerAccountId,
      amenityType: config.name,
      documentNumber: null,
      customerName: actor.displayName || actor.email || null,
      startTime,
      endTime,
      pax,
      price: priceStr,
      paymentStatus,
      status: 'confirmed',
    }).returning();

    if (this.realtime && inserted) {
      this.realtime.emitToProperty(actor.propertyId, 'amenity:reservation_created', inserted);
      const occupancy = await this.getOccupancy(actor.propertyId);
      this.realtime.emitToProperty(actor.propertyId, 'amenity:occupancy_changed', occupancy);
    }

    return inserted;
  }
}
