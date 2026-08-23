import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { AuthenticatedAccount } from '../auth/auth.types.js';
import type { RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import {
  inventoryItems,
  inventoryLedger,
  menuItemIngredients,
  menuItems,
  orderItems,
  orders,
  stays,
} from '../database/schema/index.js';

import { FolioService } from '../folios/folio.service.js';

import { Inject } from '@nestjs/common';
import type {
  AdjustInventoryDto,
  ArchiveDto,
  AdvanceOrderDto,
  CancelOrderDto,
  CreateInventoryItemDto,
  CreateMenuItemDto,
  CreateOrderDto,
} from './restaurant.dto.js';

const ORDER_FLOW = [
  'Pedido recibido',
  'Confirmado',
  'En preparacion',
  'Listo',
  'Entregado',
  'Pagado',
] as const;

@Injectable()
export class RestaurantService {
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly folios: FolioService) {}

  // ─── Menu ────────────────────────────────────────────────────────────────────
  async listMenu(propertyId: string) {
    const items = await this.db.select().from(menuItems).where(eq(menuItems.propertyId, propertyId)).orderBy(menuItems.name);
    const allIngredients = items.length
      ? await this.db.select().from(menuItemIngredients).where(inArray(menuItemIngredients.menuItemId, items.map((i) => i.id)))
      : [];
    return items.map((item) => ({ ...item, ingredients: allIngredients.filter((ing) => ing.menuItemId === item.id) }));
  }

  async createMenuItem(actor: AuthenticatedAccount, dto: CreateMenuItemDto, _ctx: unknown) {
    return this.db.transaction(async (tx) => {
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
          dto.ingredients.map((ing) => ({ menuItemId: item!.id, inventoryItemId: ing.inventoryItemId, quantity: String(ing.quantity) }))
        );
      }
      return item;
    });
  }

  async updateMenuItem(actor: AuthenticatedAccount, itemId: string, dto: CreateMenuItemDto, _ctx: unknown) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(menuItems).where(and(eq(menuItems.id, itemId), eq(menuItems.propertyId, actor.propertyId)));
      if (!existing) throw new NotFoundException('Item de menu no encontrado.');
      if (existing.status === 'archived') throw new BadRequestException('Reactiva el item antes de editarlo.');
      await tx.delete(menuItemIngredients).where(eq(menuItemIngredients.menuItemId, itemId));
      if (dto.ingredients.length) {
        await tx.insert(menuItemIngredients).values(
          dto.ingredients.map((ing) => ({ menuItemId: itemId, inventoryItemId: ing.inventoryItemId, quantity: String(ing.quantity) }))
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
    if (existing.status === 'archived') throw new ConflictException('El item ya esta archivado.');
    const [updated] = await this.db.update(menuItems).set({ status: 'archived', updatedAt: new Date() }).where(eq(menuItems.id, itemId)).returning();
    return updated;
  }

  // ─── Inventory ───────────────────────────────────────────────────────────────
  async listInventory(propertyId: string) {
    return this.db.select().from(inventoryItems).where(eq(inventoryItems.propertyId, propertyId)).orderBy(inventoryItems.name);
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

  // ─── Orders ──────────────────────────────────────────────────────────────────
  async listOrders(propertyId: string) {
    const ordersList = await this.db.select().from(orders).where(eq(orders.propertyId, propertyId)).orderBy(desc(orders.createdAt)).limit(100);
    if (!ordersList.length) return [];
    const allItems = await this.db.select().from(orderItems).where(inArray(orderItems.orderId, ordersList.map((o) => o.id)));
    return ordersList.map((order) => ({ ...order, items: allItems.filter((i) => i.orderId === order.id) }));
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
        return { menuItemId: item.menuItemId, menuItemName: menu.name, quantity: item.quantity, unitPrice: String(Number(menu.salePrice).toFixed(2)), subtotal: String(subtotal.toFixed(2)) };
      });

      const orderInsert = await tx.insert(orders).values({
        propertyId: actor.propertyId,
        source: dto.source, stayId: dto.stayId ?? null,
        paymentMethod: dto.paymentMethod, estimatedMinutes: dto.estimatedMinutes,
        comment: dto.comment ?? null, total: String(total.toFixed(2)),
        responsible: actor.email,
      }).returning();

      const newOrder = orderInsert[0]!;
      await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: newOrder.id })));
      return { ...newOrder, items: lines };
    });
  }

  async updateOrder(actor: AuthenticatedAccount, orderId: string, dto: CreateOrderDto, _ctx: unknown) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.propertyId, actor.propertyId)));
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      if (!['Pedido recibido', 'Confirmado'].includes(order.status)) throw new BadRequestException('El pedido ya no se puede editar.');

      const menuIds = dto.items.map((i) => i.menuItemId);
      const menuRows = await tx.select().from(menuItems).where(inArray(menuItems.id, menuIds));
      let total = 0;
      const lines = dto.items.map((item) => {
        const menu = menuRows.find((m) => m.id === item.menuItemId)!;
        const subtotal = Number(menu.salePrice) * item.quantity;
        total += subtotal;
        return { menuItemId: item.menuItemId, menuItemName: menu.name, quantity: item.quantity, unitPrice: String(Number(menu.salePrice).toFixed(2)), subtotal: String(subtotal.toFixed(2)), orderId };
      });

      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await tx.insert(orderItems).values(lines);
      const [updated] = await tx.update(orders).set({
        source: dto.source, stayId: dto.stayId ?? null, paymentMethod: dto.paymentMethod,
        estimatedMinutes: dto.estimatedMinutes, comment: dto.comment ?? null,
        total: String(total.toFixed(2)), updatedAt: new Date(),
      }).where(eq(orders.id, orderId)).returning();
      return { ...updated, items: lines };
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
        const allIngredients = lines.length
          ? await tx.select().from(menuItemIngredients).where(inArray(menuItemIngredients.menuItemId, lines.map((l) => l.menuItemId)))
          : [];
        for (const line of lines) {
          const ings = allIngredients.filter((i) => i.menuItemId === line.menuItemId);
          for (const ing of ings) {
            const [invItem] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, ing.inventoryItemId));
            if (!invItem) continue;
            const needed = Number(ing.quantity) * line.quantity;
            const available = Number(invItem.stock) - Number(invItem.reserved);
            if (available < needed) throw new BadRequestException(`Stock insuficiente para: ${invItem.name}. Disponible: ${available}, necesario: ${needed}`);
            await tx.update(inventoryItems).set({ reserved: String((Number(invItem.reserved) + needed).toFixed(4)) }).where(eq(inventoryItems.id, ing.inventoryItemId));
            await tx.insert(inventoryLedger).values({ propertyId: actor.propertyId, inventoryItemId: ing.inventoryItemId, type: 'Reserva', quantity: String((-needed).toFixed(4)), referenceId: orderId, note: `Reserva por pedido ${orderId}`, responsible: actor.email });
          }
        }
        inventoryStage = 'Reservado';
      }

      // Al estar listo: consumir stock
      if (nextStatus === 'Listo' && order.inventoryStage === 'Reservado') {
        const allIngredients = lines.length
          ? await tx.select().from(menuItemIngredients).where(inArray(menuItemIngredients.menuItemId, lines.map((l) => l.menuItemId)))
          : [];
        for (const line of lines) {
          const ings = allIngredients.filter((i) => i.menuItemId === line.menuItemId);
          for (const ing of ings) {
            const [invItem] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, ing.inventoryItemId));
            if (!invItem) continue;
            const needed = Number(ing.quantity) * line.quantity;
            await tx.update(inventoryItems).set({
              stock: String(Math.max(0, Number(invItem.stock) - needed).toFixed(4)),
              reserved: String(Math.max(0, Number(invItem.reserved) - needed).toFixed(4)),
            }).where(eq(inventoryItems.id, ing.inventoryItemId));
            await tx.insert(inventoryLedger).values({ propertyId: actor.propertyId, inventoryItemId: ing.inventoryItemId, type: 'Consumo', quantity: String((-needed).toFixed(4)), referenceId: orderId, note: `Consumo por pedido ${orderId}`, responsible: actor.email });
          }
        }
        inventoryStage = 'Consumido';
      }

      if (order.stayId && order.status === 'Listo' && nextStatus === 'Entregado') {
        const stay = (await tx.select({ id: stays.id }).from(stays).where(and(eq(stays.id, order.stayId), eq(stays.propertyId, actor.propertyId), eq(stays.status, 'active'))).limit(1).for('update', { of: stays }))[0];
        if (!stay) throw new ConflictException('The linked stay is not active in this property.');
        await this.folios.postRestaurantCharge(tx, actor, stay.id, order.id, order.total, context);
      }
      const accountingStage = nextStatus === 'Pagado' ? 'Pagado' : order.accountingStage;
      const [updated] = await tx.update(orders).set({ status: nextStatus, inventoryStage, accountingStage, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
      return updated;
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
            const needed = Number(ing.quantity) * line.quantity;
            await tx.update(inventoryItems).set({ reserved: String(Math.max(0, Number(invItem.reserved) - needed).toFixed(4)) }).where(eq(inventoryItems.id, ing.inventoryItemId));
            await tx.insert(inventoryLedger).values({ propertyId: actor.propertyId, inventoryItemId: ing.inventoryItemId, type: 'Devolucion', quantity: String(needed.toFixed(4)), referenceId: orderId, note: `Devolucion por cancelacion de pedido ${orderId}`, responsible: actor.email });
          }
        }
      }

      const [updated] = await tx.update(orders).set({ status: 'Cancelado', cancelReason: dto.reason, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
      return updated;
    });
  }
}
