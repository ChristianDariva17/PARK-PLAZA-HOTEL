import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { AuthenticatedAccount } from '../auth/auth.types.js';
import type { RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import {
  customerGuestIdentities,
  customerOrderCommands,
  customerOrders,
  customerReservations,
  inventoryItems,
  inventoryLedger,
  menuItemVariants,
  menuItemIngredients,
  menuItems,
  orderItems,
  orders,
  rooms,
  stayGuests,
  stays,
  amenityReservations,
  suppliers,
} from '../database/schema/index.js';
import type { AuthenticatedCustomer } from '../customer/customer.types.js';
import type { CustomerCancelOrderDto, CustomerCreateOrderDto } from '../customer/customer.dto.js';

import { FolioService } from '../folios/folio.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

import type {
  AdjustInventoryDto,
  AdvanceOrderItemDto,
  ArchiveDto,
  AdvanceOrderDto,
  CancelOrderDto,
  CreateInventoryItemDto,
  CreateMenuItemDto,
  CreateOrderDto,
} from './restaurant.dto.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const ORDER_FLOW = [
  'Pedido recibido',
  'Confirmado',
  'En preparacion',
  'Listo',
  'Entregado',
  'Pagado',
] as const;

export function determineStation(category?: string | null): 'bar' | 'coffee' | 'kitchen' {
  if (!category) return 'kitchen';
  const c = category.toLowerCase().trim();
  if (c.includes('bar') || c.includes('tiki') || c.includes('autor') || c.includes('cerveza') || c.includes('gaseosa') || c.includes('bebida') || c.includes('refresco')) {
    return 'bar';
  }
  if (c.includes('café') || c.includes('cafe') || c.includes('infusion') || c.includes('frappe')) {
    return 'coffee';
  }
  return 'kitchen';
}

export function convertIngredientToInventoryUnit(qty: number, recipeUnit?: string | null, inventoryUnit?: string | null): number {
  if (!recipeUnit || !inventoryUnit) return qty;
  const rUnit = recipeUnit.toLowerCase().trim();
  const iUnit = inventoryUnit.toLowerCase().trim();
  if (rUnit === iUnit) return qty;

  // Bar conversion: oz to bottle / liter / ml
  if (rUnit === 'oz' || rUnit === 'onza' || rUnit === 'onzas') {
    if (iUnit.includes('750')) return qty / 25.3605;
    if (iUnit.includes('1000') || iUnit.includes('litro') || iUnit === 'l' || iUnit === 'lt') return qty / 33.814;
    if (iUnit === 'ml' || iUnit.includes('mili')) return qty * 29.5735;
    if (iUnit.includes('botella')) return qty / 25.3605;
  }

  // Bar conversion: dash to bottle / ml
  if (rUnit === 'dash' || rUnit === 'gotas' || rUnit === 'golpe') {
    if (iUnit.includes('botella') || iUnit.includes('frasco')) return qty / 200;
    if (iUnit === 'ml') return qty * 0.92;
    if (iUnit === 'oz') return qty / 32;
  }

  // Kitchen conversion: g to kg
  if ((rUnit === 'g' || rUnit === 'gr' || rUnit === 'gramos') && (iUnit === 'kg' || iUnit === 'kilo' || iUnit === 'kilos')) {
    return qty / 1000;
  }
  if ((rUnit === 'kg' || rUnit === 'kilo' || rUnit === 'kilos') && (iUnit === 'g' || iUnit === 'gr' || iUnit === 'gramos')) {
    return qty * 1000;
  }
  if (rUnit === 'ml' && (iUnit === 'l' || iUnit === 'lt' || iUnit === 'litro' || iUnit === 'litros')) {
    return qty / 1000;
  }

  return qty;
}

@Injectable()
export class RestaurantService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly folios: FolioService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ─── Menu ────────────────────────────────────────────────────────────────────
  private async listMenuRecords(propertyId: string, includeHidden: boolean) {
    const items = await this.db.select().from(menuItems).where(eq(menuItems.propertyId, propertyId)).orderBy(menuItems.name);
    const allIngredients = items.length
      ? await this.db.select().from(menuItemIngredients).where(inArray(menuItemIngredients.menuItemId, items.map((i) => i.id)))
      : [];
    const allVariants = items.length
      ? await this.db.select().from(menuItemVariants).where(inArray(menuItemVariants.menuItemId, items.map((i) => i.id)))
      : [];
    const allInventory = await this.db.select().from(inventoryItems).where(eq(inventoryItems.propertyId, propertyId));
    const invMap = new Map(allInventory.map((i) => [i.id, i]));

    return items.filter((item) => includeHidden || (item.status === 'active' && item.isPublished && item.isAvailable)).map((item) => {
      const itemIngs = allIngredients.filter((ing) => ing.menuItemId === item.id);
      let calculatedCost = 0;
      for (const ing of itemIngs) {
        const inv = invMap.get(ing.inventoryItemId);
        if (inv) {
          const convertedQty = convertIngredientToInventoryUnit(Number(ing.quantity), ing.unit, inv.unit);
          calculatedCost += convertedQty * Number(inv.cost);
        }
      }
      const salePriceNum = Number(item.salePrice || 0);
      const grossMarginPercent = salePriceNum > 0 ? Math.round(((salePriceNum - calculatedCost) / salePriceNum) * 1000) / 10 : 0;
      const profitPerUnit = Math.max(0, Math.round((salePriceNum - calculatedCost) * 100) / 100);

      return {
        ...item,
        ingredients: itemIngs,
        variants: allVariants.filter((variant) => variant.menuItemId === item.id && (includeHidden || (variant.status === 'active' && variant.isPublished && variant.isAvailable && variant.price !== null))),
        costSummary: {
          recipeCost: Math.round(calculatedCost * 100) / 100,
          grossMarginPercent,
          profitPerUnit,
          isProfitable: grossMarginPercent >= 60,
        },
      };
    });
  }

  async listMenu(propertyId: string) {
    return this.listMenuRecords(propertyId, false);
  }

  async listManagedMenu(propertyId: string) {
    return this.listMenuRecords(propertyId, true);
  }

  async createMenuItem(actor: AuthenticatedAccount, dto: CreateMenuItemDto, _ctx: unknown) {
    return this.db.transaction(async (tx) => {
      if (dto.ingredients.length) {
        const inventoryIds = dto.ingredients.map((ingredient) => ingredient.inventoryItemId);
        const inventoryRows = await tx.select({ id: inventoryItems.id }).from(inventoryItems).where(and(
          inArray(inventoryItems.id, inventoryIds),
          eq(inventoryItems.propertyId, actor.propertyId),
          eq(inventoryItems.status, 'active'),
        ));
        if (inventoryRows.length !== new Set(inventoryIds).size) {
          throw new BadRequestException('Todos los insumos deben estar activos en la propiedad autenticada.');
        }
      }
      const duplicate = await tx.select({ id: menuItems.id }).from(menuItems)
        .where(and(eq(menuItems.propertyId, actor.propertyId), eq(menuItems.name, dto.name.trim()), eq(menuItems.status, 'active')));
      if (duplicate.length) throw new ConflictException('Ya existe un item de menu activo con ese nombre.');
      const [item] = await tx.insert(menuItems).values({
        propertyId: actor.propertyId,
        name: dto.name.trim(),
        category: dto.category,
        salePrice: String(Number(dto.salePrice).toFixed(2)),
        description: dto.description ?? null,
        preparationMinutes: dto.preparationMinutes,
      }).returning();
      if (dto.ingredients.length && item) {
        await tx.insert(menuItemIngredients).values(
          dto.ingredients.map((ing) => ({
            menuItemId: item!.id,
            inventoryItemId: ing.inventoryItemId,
            quantity: String(ing.quantity),
            unit: ing.unit ?? 'und',
            detail: ing.detail ?? null,
            propertyId: actor.propertyId,
          }))
        );
      }
      return item;
    });
  }

  async updateMenuItem(actor: AuthenticatedAccount, itemId: string, dto: CreateMenuItemDto, _ctx: unknown) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(menuItems).where(and(eq(menuItems.id, itemId), eq(menuItems.propertyId, actor.propertyId)));
      if (!existing) throw new NotFoundException('Item de menu no encontrado.');
      if (existing.managementMode === 'imported') throw new ConflictException('Los items importados solo se modifican mediante el importador.');
      if (existing.status === 'archived') throw new BadRequestException('Reactiva el item antes de editarlo.');
      await tx.delete(menuItemIngredients).where(eq(menuItemIngredients.menuItemId, itemId));
      if (dto.ingredients.length) {
        await tx.insert(menuItemIngredients).values(
          dto.ingredients.map((ing) => ({
            menuItemId: itemId,
            inventoryItemId: ing.inventoryItemId,
            quantity: String(ing.quantity),
            unit: ing.unit ?? 'und',
            detail: ing.detail ?? null,
            propertyId: actor.propertyId,
          }))
        );
      }
      const [updated] = await tx.update(menuItems).set({
        name: dto.name.trim(), category: dto.category, salePrice: String(Number(dto.salePrice).toFixed(2)),
        description: dto.description ?? null, preparationMinutes: dto.preparationMinutes,
        updatedAt: new Date(),
      }).where(eq(menuItems.id, itemId)).returning();
      return updated;
    });
  }

  async archiveMenuItem(actor: AuthenticatedAccount, itemId: string, dto: ArchiveDto) {
    const [existing] = await this.db.select().from(menuItems).where(and(eq(menuItems.id, itemId), eq(menuItems.propertyId, actor.propertyId)));
    if (!existing) throw new NotFoundException('Item de menu no encontrado.');
    if (existing.managementMode === 'imported') throw new ConflictException('Los items importados solo se modifican mediante el importador.');
    if (existing.status === 'archived') throw new ConflictException('El item ya esta archivado.');
    const [updated] = await this.db.update(menuItems).set({ status: 'archived', updatedAt: new Date() }).where(eq(menuItems.id, itemId)).returning();
    return updated;
  }

  async reactivateMenuItem(actor: AuthenticatedAccount, itemId: string) {
    const [existing] = await this.db.select().from(menuItems).where(and(eq(menuItems.id, itemId), eq(menuItems.propertyId, actor.propertyId)));
    if (!existing) throw new NotFoundException('Item de menu no encontrado.');
    if (existing.status === 'active') throw new ConflictException('El item ya esta activo.');
    const [updated] = await this.db.update(menuItems).set({ status: 'active', updatedAt: new Date() }).where(eq(menuItems.id, itemId)).returning();
    return updated;
  }

  // ─── Inventory ───────────────────────────────────────────────────────────────
  async listInventory(propertyId: string) {
    return this.db
      .select({
        id: inventoryItems.id,
        propertyId: inventoryItems.propertyId,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
        lot: inventoryItems.lot,
        stock: inventoryItems.stock,
        reserved: inventoryItems.reserved,
        minimum: inventoryItems.minimum,
        cost: inventoryItems.cost,
        supplierId: inventoryItems.supplierId,
        supplierName: sql<string | null>`COALESCE(${suppliers.tradeName}, ${suppliers.legalName}, NULL)`,
        status: inventoryItems.status,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .leftJoin(suppliers, and(eq(suppliers.propertyId, propertyId), sql`${suppliers.id}::text = ${inventoryItems.supplierId}`))
      .where(eq(inventoryItems.propertyId, propertyId))
      .orderBy(inventoryItems.name);
  }

  async listLedger(propertyId: string) {
    return this.db.select().from(inventoryLedger).where(eq(inventoryLedger.propertyId, propertyId)).orderBy(desc(inventoryLedger.createdAt)).limit(200);
  }

  async createInventoryItem(actor: AuthenticatedAccount, dto: CreateInventoryItemDto, _ctx: unknown) {
    const [item] = await this.db.insert(inventoryItems).values({
      propertyId: actor.propertyId,
      name: dto.name.trim(),
      unit: dto.unit,
      lot: dto.lot ?? null,
      minimum: String(Number(dto.minimum).toFixed(4)),
      cost: String(Number(dto.cost).toFixed(2)),
      supplierId: dto.supplierId ?? null,
      stock: '0',
      reserved: '0',
    }).returning();
    return item;
  }

  async updateInventoryItem(actor: AuthenticatedAccount, itemId: string, dto: CreateInventoryItemDto, _ctx: unknown) {
    const [existing] = await this.db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.propertyId, actor.propertyId)));
    if (!existing) throw new NotFoundException('Insumo no encontrado.');
    if (existing.status === 'archived') throw new BadRequestException('Reactiva el insumo antes de editarlo.');
    const [updated] = await this.db.update(inventoryItems).set({
      name: dto.name.trim(), unit: dto.unit, lot: dto.lot ?? null,
      minimum: String(Number(dto.minimum).toFixed(4)), cost: String(Number(dto.cost).toFixed(2)),
      supplierId: dto.supplierId ?? null, updatedAt: new Date(),
    }).where(eq(inventoryItems.id, itemId)).returning();
    return updated;
  }

  async adjustInventory(actor: AuthenticatedAccount, itemId: string, dto: AdjustInventoryDto, _ctx: unknown) {
    return this.db.transaction(async (tx) => {
      const [item] = await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.propertyId, actor.propertyId)));
      if (!item) throw new NotFoundException('Insumo no encontrado.');
      const newStock = Math.max(0, Number(item.stock) + dto.quantity);
      const [updated] = await tx.update(inventoryItems).set({ stock: String(newStock.toFixed(4)), updatedAt: new Date() }).where(eq(inventoryItems.id, itemId)).returning();
      await tx.insert(inventoryLedger).values({
        propertyId: actor.propertyId, inventoryItemId: itemId,
        type: dto.type, quantity: String(dto.quantity.toFixed(4)),
        note: dto.note ?? `${dto.type} manual`,
        responsible: actor.email,
      });
      return updated;
    });
  }

  async archiveInventoryItem(actor: AuthenticatedAccount, itemId: string, dto: ArchiveDto) {
    const [existing] = await this.db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.propertyId, actor.propertyId)));
    if (!existing) throw new NotFoundException('Insumo no encontrado.');
    if (existing.status === 'archived') throw new ConflictException('El insumo ya esta archivado.');
    const [updated] = await this.db.update(inventoryItems).set({ status: 'archived', updatedAt: new Date() }).where(eq(inventoryItems.id, itemId)).returning();
    return updated;
  }

  async reactivateInventoryItem(actor: AuthenticatedAccount, itemId: string) {
    const [existing] = await this.db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.propertyId, actor.propertyId)));
    if (!existing) throw new NotFoundException('Insumo no encontrado.');
    if (existing.status !== 'archived') throw new BadRequestException('El insumo ya esta activo.');
    const [updated] = await this.db.update(inventoryItems).set({ status: 'active', updatedAt: new Date() }).where(eq(inventoryItems.id, itemId)).returning();
    return updated;
  }

  // ─── Orders ──────────────────────────────────────────────────────────────────
  async listOrders(propertyId: string) {
    const ordersList = await this.db.select().from(orders).where(eq(orders.propertyId, propertyId)).orderBy(desc(orders.createdAt)).limit(100);
    if (!ordersList.length) return [];
    const allItems = await this.db.select().from(orderItems).where(inArray(orderItems.orderId, ordersList.map((o) => o.id)));
    return ordersList.map((order) => ({ ...order, items: allItems.filter((i) => i.orderId === order.id) }));
  }

  private async reserveOrderInventory(tx: Transaction, actor: AuthenticatedAccount, orderId: string, lines: Array<typeof orderItems.$inferSelect>) {
    const allIngredients = lines.length
      ? await tx.select().from(menuItemIngredients).where(inArray(menuItemIngredients.menuItemId, lines.map((l) => l.menuItemId)))
      : [];
    for (const line of lines) {
      const ings = allIngredients.filter((i) => i.menuItemId === line.menuItemId);
      for (const ing of ings) {
        const [invItem] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, ing.inventoryItemId));
        if (!invItem) continue;
        const convertedPerPortion = convertIngredientToInventoryUnit(Number(ing.quantity), ing.unit, invItem.unit);
        const needed = convertedPerPortion * line.quantity;
        const available = Number(invItem.stock) - Number(invItem.reserved);
        if (available < needed) {
          throw new BadRequestException(`Stock insuficiente para: ${invItem.name}. Disponible: ${available.toFixed(2)} ${invItem.unit}, necesario: ${needed.toFixed(2)} ${invItem.unit}`);
        }
        await tx.update(inventoryItems).set({ reserved: String((Number(invItem.reserved) + needed).toFixed(4)) }).where(eq(inventoryItems.id, ing.inventoryItemId));
        await tx.insert(inventoryLedger).values({
          propertyId: actor.propertyId,
          inventoryItemId: ing.inventoryItemId,
          type: 'Reserva',
          quantity: String((-needed).toFixed(4)),
          referenceId: orderId,
          note: `Reserva por comanda ${orderId}`,
          responsible: actor.email,
        });
      }
    }
  }

  private async consumeOrderInventory(tx: Transaction, actor: AuthenticatedAccount, orderId: string, lines: Array<typeof orderItems.$inferSelect>) {
    const allIngredients = lines.length
      ? await tx.select().from(menuItemIngredients).where(inArray(menuItemIngredients.menuItemId, lines.map((l) => l.menuItemId)))
      : [];
    for (const line of lines) {
      const ings = allIngredients.filter((i) => i.menuItemId === line.menuItemId);
      for (const ing of ings) {
        const [invItem] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, ing.inventoryItemId));
        if (!invItem) continue;
        const convertedPerPortion = convertIngredientToInventoryUnit(Number(ing.quantity), ing.unit, invItem.unit);
        const needed = convertedPerPortion * line.quantity;
        await tx.update(inventoryItems).set({
          stock: String(Math.max(0, Number(invItem.stock) - needed).toFixed(4)),
          reserved: String(Math.max(0, Number(invItem.reserved) - needed).toFixed(4)),
        }).where(eq(inventoryItems.id, ing.inventoryItemId));
        await tx.insert(inventoryLedger).values({
          propertyId: actor.propertyId,
          inventoryItemId: ing.inventoryItemId,
          type: 'Consumo',
          quantity: String((-needed).toFixed(4)),
          referenceId: orderId,
          note: `Consumo por comanda ${orderId}`,
          responsible: actor.email,
        });
      }
    }
  }

  async createOrder(actor: AuthenticatedAccount, dto: CreateOrderDto, _ctx: unknown) {
    return this.db.transaction(async (tx) => {
      const menuIds = dto.items.map((i) => i.menuItemId);
      const menuRows = await tx.select().from(menuItems).where(and(inArray(menuItems.id, menuIds), eq(menuItems.propertyId, actor.propertyId)));
      const notFound = menuIds.filter((id) => !menuRows.find((m) => m.id === id && m.status === 'active'));
      if (notFound.length) throw new BadRequestException(`Items de menu no encontrados o archivados: ${notFound.join(', ')}`);

      let total = 0;
      const lines = dto.items.map((item) => {
        const menu = menuRows.find((m) => m.id === item.menuItemId)!;
        const subtotal = Number(menu.salePrice) * item.quantity;
        total += subtotal;
        const station = item.station || determineStation(menu.category);
        return {
          menuItemId: item.menuItemId,
          menuItemName: menu.name,
          quantity: item.quantity,
          unitPrice: String(Number(menu.salePrice).toFixed(2)),
          subtotal: String(subtotal.toFixed(2)),
          station,
          status: 'recibido',
          notes: item.notes ?? null,
        };
      });

      const orderInsert = await tx.insert(orders).values({
        propertyId: actor.propertyId,
        source: dto.source, stayId: dto.stayId ?? null,
        paymentMethod: dto.paymentMethod, estimatedMinutes: dto.estimatedMinutes,
        comment: dto.comment ?? null, total: String(total.toFixed(2)),
        responsible: actor.email,
      }).returning();

      const newOrder = orderInsert[0]!;
      await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: newOrder.id, propertyId: actor.propertyId })));
      const result = { ...newOrder, items: lines };
      this.realtime.emitToProperty(actor.propertyId, 'order:created', result);
      if (result.stayId) this.realtime.emitToStay(result.stayId, 'order:created', result);
      return result;
    });
  }

  async updateOrder(actor: AuthenticatedAccount, orderId: string, dto: CreateOrderDto, _ctx: unknown) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.propertyId, actor.propertyId)));
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      if (!['Pedido recibido', 'Confirmado'].includes(order.status)) throw new BadRequestException('El pedido ya no se puede editar.');

      const menuIds = dto.items.map((i) => i.menuItemId);
      const menuRows = await tx.select().from(menuItems).where(and(
        inArray(menuItems.id, menuIds),
        eq(menuItems.propertyId, actor.propertyId),
        eq(menuItems.status, 'active'),
      ));
      if (menuRows.length !== new Set(menuIds).size) {
        throw new BadRequestException('Items de menu no encontrados, fuera de la propiedad o archivados.');
      }
      let total = 0;
      const lines = dto.items.map((item) => {
        const menu = menuRows.find((m) => m.id === item.menuItemId)!;
        const subtotal = Number(menu.salePrice) * item.quantity;
        total += subtotal;
        const station = item.station || determineStation(menu.category);
        return {
          menuItemId: item.menuItemId,
          menuItemName: menu.name,
          quantity: item.quantity,
          unitPrice: String(Number(menu.salePrice).toFixed(2)),
          subtotal: String(subtotal.toFixed(2)),
          station,
          status: 'recibido',
          notes: item.notes ?? null,
          orderId,
        };
      });

      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await tx.insert(orderItems).values(lines.map((l) => ({ ...l, propertyId: actor.propertyId })));
      const [updated] = await tx.update(orders).set({
        source: dto.source, stayId: dto.stayId ?? null, paymentMethod: dto.paymentMethod,
        estimatedMinutes: dto.estimatedMinutes, comment: dto.comment ?? null,
        total: String(total.toFixed(2)), updatedAt: new Date(),
      }).where(eq(orders.id, orderId)).returning();
      const result = { ...updated, items: lines };
      this.realtime.emitToProperty(actor.propertyId, 'order:updated', result);
      if (result.stayId) this.realtime.emitToStay(result.stayId, 'order:updated', result);
      return result;
    });
  }

  async advanceOrderItem(actor: AuthenticatedAccount, orderId: string, itemId: string, dto: AdvanceOrderItemDto, context: RequestContext) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.propertyId, actor.propertyId)));
      if (!order) throw new NotFoundException('Pedido no encontrado.');

      const [item] = await tx.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId), eq(orderItems.propertyId, actor.propertyId)));
      if (!item) throw new NotFoundException('Línea de comanda no encontrada.');

      await tx.update(orderItems).set({ status: dto.status }).where(eq(orderItems.id, itemId));

      const allItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

      // Si al menos un item pasa a en_preparacion y la orden estaba en Pedido recibido
      if (allItems.some((i) => i.status === 'en_preparacion' || i.status === 'listo') && order.inventoryStage === 'Sin reservar') {
        await this.reserveOrderInventory(tx, actor, orderId, allItems);
        await tx.update(orders).set({ status: 'En preparacion', inventoryStage: 'Reservado', updatedAt: new Date() }).where(eq(orders.id, orderId));
      }

      // Si todos los items están listos o entregados
      if (allItems.every((i) => i.status === 'listo' || i.status === 'entregado') && order.status !== 'Listo' && order.status !== 'Entregado' && order.status !== 'Pagado') {
        if (order.inventoryStage === 'Reservado') {
          await this.consumeOrderInventory(tx, actor, orderId, allItems);
        }
        await tx.update(orders).set({ status: 'Listo', inventoryStage: 'Consumido', updatedAt: new Date() }).where(eq(orders.id, orderId));
      }

      const [updatedOrder] = await tx.select().from(orders).where(eq(orders.id, orderId));
      const updatedItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const result = { ...updatedOrder, items: updatedItems };
      this.realtime.emitToProperty(actor.propertyId, 'order:status_changed', result);
      if (result.stayId) this.realtime.emitToStay(result.stayId, 'order:status_changed', result);
      return result;
    });
  }

  async advanceOrder(actor: AuthenticatedAccount, orderId: string, dto: AdvanceOrderDto, context: RequestContext) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.propertyId, actor.propertyId)));
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      if (order.status !== dto.expectedStatus) throw new ConflictException('El pedido cambio de estado; actualiza la operacion.');

      const currentIndex = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
      if (currentIndex < 0 || currentIndex >= ORDER_FLOW.length - 1) throw new BadRequestException('El pedido no puede avanzar mas.');
      const nextStatus = ORDER_FLOW[currentIndex + 1];
      if (order.stayId && order.status === 'Entregado') throw new BadRequestException('Stay-linked delivered orders are financially terminal.');

      let inventoryStage = order.inventoryStage;
      const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

      // Al confirmar: reservar stock
      if (nextStatus === 'En preparacion' && order.inventoryStage === 'Sin reservar') {
        await this.reserveOrderInventory(tx, actor, orderId, lines);
        inventoryStage = 'Reservado';
        await tx.update(orderItems).set({ status: 'en_preparacion' }).where(eq(orderItems.orderId, orderId));
      }

      // Al estar listo: consumir stock
      if (nextStatus === 'Listo' && order.inventoryStage === 'Reservado') {
        await this.consumeOrderInventory(tx, actor, orderId, lines);
        inventoryStage = 'Consumido';
        await tx.update(orderItems).set({ status: 'listo' }).where(eq(orderItems.orderId, orderId));
      }

      if (order.stayId && order.status === 'Listo' && nextStatus === 'Entregado') {
        const stay = (await tx.select({ id: stays.id }).from(stays).where(and(eq(stays.id, order.stayId), eq(stays.propertyId, actor.propertyId), eq(stays.status, 'active'))).limit(1).for('update', { of: stays }))[0];
        if (!stay) throw new ConflictException('The linked stay is not active in this property.');
        await this.folios.postRestaurantCharge(tx, actor, stay.id, order.id, order.total, context);
      }

      if (nextStatus === 'Entregado') {
        await tx.update(orderItems).set({ status: 'entregado' }).where(eq(orderItems.orderId, orderId));
      }
      const accountingStage = nextStatus === 'Pagado' ? 'Pagado' : order.accountingStage;
      const [updated] = await tx.update(orders).set({ status: nextStatus, inventoryStage, accountingStage, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
      const updatedLines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      return { ...updated, items: updatedLines };
    });
  }

  async cancelOrder(actor: AuthenticatedAccount, orderId: string, dto: CancelOrderDto, context: RequestContext) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.propertyId, actor.propertyId)));
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      if (['Pagado', 'Cancelado'].includes(order.status)) throw new BadRequestException('El pedido no se puede cancelar.');
      if (order.stayId && order.status === 'Entregado') await this.folios.reverseRestaurantCharge(tx, actor, order.stayId, order.id, dto.reason, context);

      // Revertir reservas si aplica
      if (order.inventoryStage === 'Reservado') {
        const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
        const allIngredients = lines.length
          ? await tx.select().from(menuItemIngredients).where(inArray(menuItemIngredients.menuItemId, lines.map((l) => l.menuItemId)))
          : [];
        for (const line of lines) {
          const ings = allIngredients.filter((i) => i.menuItemId === line.menuItemId);
          for (const ing of ings) {
            const [invItem] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, ing.inventoryItemId));
            if (!invItem) continue;
            const convertedPerPortion = convertIngredientToInventoryUnit(Number(ing.quantity), ing.unit, invItem.unit);
            const needed = convertedPerPortion * line.quantity;
            await tx.update(inventoryItems).set({ reserved: String(Math.max(0, Number(invItem.reserved) - needed).toFixed(4)) }).where(eq(inventoryItems.id, ing.inventoryItemId));
            await tx.insert(inventoryLedger).values({ propertyId: actor.propertyId, inventoryItemId: ing.inventoryItemId, type: 'Devolucion', quantity: String(needed.toFixed(4)), referenceId: orderId, note: `Devolucion por cancelacion de pedido ${orderId}`, responsible: actor.email });
          }
        }
      }

      const [updated] = await tx.update(orders).set({ status: 'Cancelado', cancelReason: dto.reason, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
      return updated;
    });
  }

  // ─── Customer Portal Restaurant Operations ──────────────────────────────────
  async listCustomerOrders(customer: AuthenticatedCustomer) {
    const customerOrderRows = await this.db.select({
      id: orders.id,
      source: orders.source,
      stayId: orders.stayId,
      status: orders.status,
      total: orders.total,
      estimatedMinutes: orders.estimatedMinutes,
      comment: orders.comment,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(customerOrders, and(eq(customerOrders.orderId, orders.id), eq(customerOrders.propertyId, customer.propertyId)))
    .where(and(
      eq(customerOrders.customerAccountId, customer.customerAccountId),
      eq(orders.propertyId, customer.propertyId),
    ))
    .orderBy(desc(orders.createdAt));

    if (!customerOrderRows.length) return [];

    const orderIds = customerOrderRows.map((o) => o.id);
    const items = await this.db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));

    return customerOrderRows.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
      items: items
        .filter((item) => item.orderId === order.id)
        .map((item) => ({
          id: item.id,
          name: item.menuItemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
    }));
  }

  async listCustomerActiveStays(customer: AuthenticatedCustomer) {
    const activeStayRows = await this.db.select({
      id: stays.id,
      roomNumber: rooms.number,
      checkInAt: stays.checkInAt,
    })
    .from(stays)
    .innerJoin(rooms, and(eq(rooms.id, stays.roomId), eq(rooms.propertyId, customer.propertyId)))
    .leftJoin(customerReservations, and(eq(customerReservations.reservationId, stays.reservationId), eq(customerReservations.propertyId, customer.propertyId)))
    .leftJoin(stayGuests, and(eq(stayGuests.stayId, stays.id), eq(stayGuests.propertyId, customer.propertyId)))
    .leftJoin(customerGuestIdentities, and(eq(customerGuestIdentities.guestId, stayGuests.guestId), eq(customerGuestIdentities.propertyId, customer.propertyId)))
    .where(and(
      eq(stays.propertyId, customer.propertyId),
      eq(stays.status, 'active'),
      or(
        eq(customerReservations.customerAccountId, customer.customerAccountId),
        eq(customerGuestIdentities.customerAccountId, customer.customerAccountId),
      ),
    ));

    return {
      stays: activeStayRows.map((row) => ({
        id: row.id,
        roomNumber: row.roomNumber,
        checkInAt: row.checkInAt.toISOString(),
      })),
    };
  }

  async createCustomerOrder(customer: AuthenticatedCustomer, dto: CustomerCreateOrderDto, idempotencyKey: string) {
    if (dto.paymentMode !== 'room_charge' && dto.paymentMode !== 'amenity_tab') {
      throw new HttpException({ version: 1, outcome: 'rejected', code: 'PAYMENT_MODE_UNSUPPORTED' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const fingerprint = this.fingerprint({
      customer: customer.customerAccountId,
      property: customer.propertyId,
      ...dto,
      items: this.normalizedItems(dto.items),
    });

    return this.db.transaction(async (tx) => {
      const replay = await this.findReceipt(tx, customer, 'create', idempotencyKey, fingerprint);
      if (replay) return replay;

      let amenityRecord: any = null;
      if (dto.stayId) {
        await this.assertCustomerStay(tx, customer, dto.stayId);
      } else if (dto.amenityReservationId) {
        amenityRecord = await this.assertCustomerAmenityReservation(tx, customer, dto.amenityReservationId);
      } else {
        throw new BadRequestException('Se requiere una estadía activa o una reserva de amenidad.');
      }

      const lines = await this.buildOrderLines(tx, customer.propertyId, dto);
      const total = lines.reduce((acc, l) => acc + Number(l.subtotal), 0).toFixed(2);

      const sourceName = dto.amenityReservationId
        ? `Portal Visitante - ${amenityRecord?.amenityType || 'Amenidad'}`
        : 'Portal Huésped';

      const [insertedOrder] = await tx.insert(orders).values({
        propertyId: customer.propertyId,
        stayId: dto.stayId ?? null,
        amenityReservationId: dto.amenityReservationId ?? null,
        source: sourceName,
        paymentMethod: dto.amenityReservationId ? 'amenity_tab' : 'room_charge',
        checkoutClassification: 'customer_checkout',
        paymentMode: dto.paymentMode || (dto.amenityReservationId ? 'amenity_tab' : 'room_charge'),
        deliveryMode: dto.deliveryMode,
        total: String(total),
        estimatedMinutes: 20,
        comment: dto.note || '',
        status: 'Pedido recibido',
        responsible: customer.email,
      } as any).returning();

      if (!insertedOrder) throw new Error('Failed to create order');

      if (dto.amenityReservationId) {
        await tx.update(amenityReservations)
          .set({ paymentStatus: 'open_tab' })
          .where(eq(amenityReservations.id, dto.amenityReservationId));
      }

      await tx.insert(orderItems).values(
        lines.map((l) => ({
          ...l,
          propertyId: customer.propertyId,
          orderId: insertedOrder.id,
        }))
      );

      await tx.insert(customerOrders).values({
        orderId: insertedOrder.id,
        customerAccountId: customer.customerAccountId,
        propertyId: customer.propertyId,
      });

      const responseBody = {
        version: 1,
        outcome: 'accepted',
        code: 'ORDER_CREATED',
        order: {
          ...insertedOrder,
          stayId: dto.stayId,
          amenityReservationId: dto.amenityReservationId,
          checkoutClassification: 'customer_checkout',
          paymentMode: dto.paymentMode,
          items: lines,
        },
      };

      await tx.insert(customerOrderCommands).values({
        propertyId: customer.propertyId,
        customerAccountId: customer.customerAccountId,
        orderId: insertedOrder.id,
        idempotencyKey,
        fingerprint,
        operation: 'create',
        responseStatus: '201',
        response: { status: 201, body: responseBody },
      });

      this.realtime.emitToProperty(customer.propertyId, 'order:created', responseBody.order);
      if (dto.stayId) this.realtime.emitToStay(dto.stayId, 'order:created', responseBody.order);

      return responseBody;
    });
  }

  async cancelCustomerOrder(customer: AuthenticatedCustomer, orderId: string, dto: CustomerCancelOrderDto, idempotencyKey: string) {
    const fingerprint = this.fingerprint({
      customer: customer.customerAccountId,
      property: customer.propertyId,
      command: 'cancel',
      orderId,
      reasonCode: dto.reasonCode,
    });

    return this.db.transaction(async (tx) => {
      const replay = await this.findReceipt(tx, customer, 'cancel', idempotencyKey, fingerprint);
      if (replay) return replay;

      const customerOrderRows = await tx.select({ orderId: customerOrders.orderId })
        .from(customerOrders)
        .where(and(
          eq(customerOrders.orderId, orderId),
          eq(customerOrders.customerAccountId, customer.customerAccountId),
          eq(customerOrders.propertyId, customer.propertyId),
        )).limit(1);

      if (!customerOrderRows[0]) {
        throw new HttpException({ version: 1, outcome: 'rejected', code: 'ORDER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
      }

      const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.propertyId, customer.propertyId))).limit(1);
      if (!order) {
        throw new HttpException({ version: 1, outcome: 'rejected', code: 'ORDER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
      }

      if (!['Pedido recibido', 'Confirmado'].includes(order.status)) {
        throw new HttpException({ version: 1, outcome: 'rejected', code: 'CUSTOMER_CANCELLATION_INELIGIBLE' }, HttpStatus.CONFLICT);
      }

      const [updated] = await tx.update(orders).set({
        status: 'Cancelado',
        cancelReason: dto.reasonCode,
        updatedAt: new Date(),
      }).where(eq(orders.id, orderId)).returning();

      const responseBody = {
        version: 1,
        outcome: 'accepted',
        code: 'ORDER_CANCELLED',
        order: updated,
      };

      await tx.insert(customerOrderCommands).values({
        propertyId: customer.propertyId,
        customerAccountId: customer.customerAccountId,
        orderId,
        idempotencyKey,
        fingerprint,
        operation: 'cancel',
        responseStatus: '200',
        response: { status: 200, body: responseBody },
      });

      return responseBody;
    });
  }

  normalizedItems(items: Array<{ menuItemId: string; variantId?: string | null | undefined; quantity: number }>) {
    return [...items].sort((a, b) => {
      const cmp = a.menuItemId.localeCompare(b.menuItemId);
      if (cmp !== 0) return cmp;
      return (a.variantId || '').localeCompare(b.variantId || '');
    });
  }

  fingerprint(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private async findReceipt(tx: any, customer: AuthenticatedCustomer, operation: string, idempotencyKey: string, fingerprint: string) {
    const rows = await tx.select().from(customerOrderCommands)
      .where(and(
        eq(customerOrderCommands.customerAccountId, customer.customerAccountId),
        eq(customerOrderCommands.operation, operation),
        eq(customerOrderCommands.idempotencyKey, idempotencyKey),
      )).limit(1).for('update');
    const receipt = rows[0];
    if (!receipt) return null;
    if (receipt.fingerprint !== fingerprint) {
      throw new HttpException({ version: 1, outcome: 'rejected', code: 'CUSTOMER_COMMAND_CONFLICT' }, HttpStatus.CONFLICT);
    }
    return receipt.response?.body ?? receipt.response;
  }

  private async buildOrderLines(tx: any, propertyId: string, dto: { items: Array<{ menuItemId: string; variantId?: string | null | undefined; quantity: number }> }) {
    const menuIds = dto.items.map((i) => i.menuItemId);
    const menuRows = await tx.select().from(menuItems).where(and(inArray(menuItems.id, menuIds), eq(menuItems.propertyId, propertyId)));
    return dto.items.map((item) => {
      const menu = menuRows.find((m: any) => m.id === item.menuItemId && m.status === 'active');
      if (!menu) throw new BadRequestException(`Menu item not found or inactive: ${item.menuItemId}`);
      const unitPrice = String(Number(menu.salePrice).toFixed(2));
      const subtotal = String((Number(menu.salePrice) * item.quantity).toFixed(2));
      return {
        menuItemId: item.menuItemId,
        menuItemName: menu.name,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      };
    });
  }

  private async assertCustomerStay(tx: any, customer: AuthenticatedCustomer, stayId: string) {
    const stayRows = await tx.select({ id: stays.id, roomId: stays.roomId }).from(stays)
      .innerJoin(stayGuests, and(eq(stayGuests.stayId, stays.id), eq(stayGuests.propertyId, customer.propertyId)))
      .innerJoin(customerGuestIdentities, and(eq(customerGuestIdentities.guestId, stayGuests.guestId), eq(customerGuestIdentities.propertyId, customer.propertyId)))
      .where(and(
        eq(stays.id, stayId),
        eq(stays.propertyId, customer.propertyId),
        eq(stays.status, 'active'),
        eq(customerGuestIdentities.customerAccountId, customer.customerAccountId),
      )).limit(1);

    if (!stayRows[0]) {
      throw new HttpException({ version: 1, outcome: 'rejected', code: 'ACTIVE_STAY_UNAUTHORIZED' }, HttpStatus.FORBIDDEN);
    }
    return stayRows[0];
  }

  private async assertCustomerAmenityReservation(tx: any, customer: AuthenticatedCustomer, reservationId: string) {
    const rows = await tx.select().from(amenityReservations)
      .where(and(
        eq(amenityReservations.id, reservationId),
        eq(amenityReservations.propertyId, customer.propertyId),
        eq(amenityReservations.customerAccountId, customer.customerAccountId),
        eq(amenityReservations.status, 'confirmed'),
      )).limit(1);

    if (!rows[0]) {
      throw new HttpException({ version: 1, outcome: 'rejected', code: 'AMENITY_RESERVATION_UNAUTHORIZED' }, HttpStatus.FORBIDDEN);
    }
    return rows[0];
  }
}
