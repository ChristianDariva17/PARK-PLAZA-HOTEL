import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { AuthenticatedAccount } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Req } from '@nestjs/common';
import {
  parseAdjustInventoryDto,
  parseAdvanceOrderItemDto,
  parseArchiveDto,
  parseAdvanceOrderDto,
  parseCancelOrderDto,
  parseCreateInventoryItemDto,
  parseCreateMenuItemDto,
  parseCreateOrderDto,
  parseUpdateInventoryItemDto,
  parseUpdateMenuItemDto,
  parseUpdateOrderDto,
  parseUuidParam,
} from './restaurant.dto.js';
import { RestaurantService } from './restaurant.service.js';

@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurant: RestaurantService) {}

  // ─── Menu ─────────────────────────────────────────────────────────────────
  @Get('menu')
  @RequirePermissions('orders.read')
  listMenu(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.restaurant.listMenu(actor.propertyId);
  }

  @Get('internal/menu')
  @RequirePermissions('kitchen.create', 'kitchen.update', 'kitchen.archive')
  listInternalMenu(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.restaurant.listManagedMenu(actor.propertyId);
  }

  @Post('menu')
  @RequirePermissions('kitchen.create')
  createMenuItem(
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.createMenuItem(actor, parseCreateMenuItemDto(body), getRequestContext(req));
  }

  @Patch('menu/:id')
  @RequirePermissions('kitchen.update')
  updateMenuItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.updateMenuItem(actor, parseUuidParam(id), parseUpdateMenuItemDto(body), getRequestContext(req));
  }

  @Post('menu/:id/archive')
  @RequirePermissions('kitchen.archive')
  archiveMenuItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
  ) {
    return this.restaurant.archiveMenuItem(actor, parseUuidParam(id), parseArchiveDto(body));
  }

  @Post('menu/:id/reactivate')
  @RequirePermissions('kitchen.archive')
  reactivateMenuItem(
    @Param('id') id: string,
    @CurrentAccount() actor: AuthenticatedAccount,
  ) {
    return this.restaurant.reactivateMenuItem(actor, parseUuidParam(id));
  }

  // ─── Inventory ────────────────────────────────────────────────────────────
  @Get('inventory')
  @RequirePermissions('inventory.read')
  listInventory(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.restaurant.listInventory(actor.propertyId);
  }

  @Get('inventory/ledger')
  @RequirePermissions('inventory.read')
  listLedger(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.restaurant.listLedger(actor.propertyId);
  }

  @Post('inventory')
  @RequirePermissions('inventory.create')
  createInventoryItem(
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.createInventoryItem(actor, parseCreateInventoryItemDto(body), getRequestContext(req));
  }

  @Patch('inventory/:id')
  @RequirePermissions('inventory.update')
  updateInventoryItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.updateInventoryItem(actor, parseUuidParam(id), parseUpdateInventoryItemDto(body), getRequestContext(req));
  }

  @Post('inventory/:id/adjust')
  @RequirePermissions('inventory.adjust')
  adjustInventory(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.adjustInventory(actor, parseUuidParam(id), parseAdjustInventoryDto(body), getRequestContext(req));
  }

  @Post('inventory/:id/archive')
  @RequirePermissions('inventory.archive')
  archiveInventoryItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
  ) {
    return this.restaurant.archiveInventoryItem(actor, parseUuidParam(id), parseArchiveDto(body));
  }

  @Post('inventory/:id/reactivate')
  @RequirePermissions('inventory.archive')
  reactivateInventoryItem(
    @Param('id') id: string,
    @CurrentAccount() actor: AuthenticatedAccount,
  ) {
    return this.restaurant.reactivateInventoryItem(actor, parseUuidParam(id));
  }

  // ─── Orders ───────────────────────────────────────────────────────────────
  @Get('orders')
  @RequirePermissions('orders.read')
  listOrders(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.restaurant.listOrders(actor.propertyId);
  }

  @Post('orders')
  @RequirePermissions('orders.create')
  createOrder(
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.createOrder(actor, parseCreateOrderDto(body), getRequestContext(req));
  }

  @Patch('orders/:id')
  @RequirePermissions('orders.update')
  updateOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.updateOrder(actor, parseUuidParam(id), parseUpdateOrderDto(body), getRequestContext(req));
  }

  @Post('orders/:id/advance')
  @RequirePermissions('orders.advance')
  advanceOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.advanceOrder(actor, parseUuidParam(id), parseAdvanceOrderDto(body), getRequestContext(req));
  }

  @Post('orders/:orderId/items/:itemId/advance')
  @RequirePermissions('orders.advance')
  advanceOrderItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.advanceOrderItem(
      actor,
      parseUuidParam(orderId),
      parseUuidParam(itemId),
      parseAdvanceOrderItemDto(body),
      getRequestContext(req),
    );
  }

  @Post('orders/:id/cancel')
  @RequirePermissions('orders.cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.restaurant.cancelOrder(actor, parseUuidParam(id), parseCancelOrderDto(body), getRequestContext(req));
  }
}
