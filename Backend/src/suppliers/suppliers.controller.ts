import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import {
  parseCreateSupplierDto,
  parseUpdateSupplierDto,
  parseArchiveSupplierDto,
  parseReactivateSupplierDto,
  parseAssignSupplierInventoryDto,
  parseRestockFromSupplierDto,
  parseCreatePurchaseOrderDto,
  parseReceivePurchaseOrderDto,
  parseRateSupplierDto,
} from './suppliers.dto.js';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get('reorder-suggestions')
  @RequirePermissions('suppliers.read')
  async getReorderSuggestions(@CurrentAccount() account: any) {
    return this.suppliersService.getReorderSuggestions(account.propertyId);
  }

  @Get('purchase-orders')
  @RequirePermissions('suppliers.read')
  async listPurchaseOrders(
    @CurrentAccount() account: any,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    return this.suppliersService.listPurchaseOrders(account.propertyId, {
      ...(supplierId ? { supplierId } : {}),
      ...(status ? { status } : {}),
    });
  }

  @Get('purchase-orders/:id')
  @RequirePermissions('suppliers.read')
  async getPurchaseOrder(
    @CurrentAccount() account: any,
    @Param('id') id: string
  ) {
    return this.suppliersService.getPurchaseOrder(account.propertyId, id);
  }

  @Post('purchase-orders')
  @RequirePermissions('suppliers.create')
  async createPurchaseOrder(
    @CurrentAccount() account: any,
    @Body() body: any,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    const dto = parseCreatePurchaseOrderDto(body);
    return this.suppliersService.createPurchaseOrder(account.propertyId, dto, idempotencyKey || crypto.randomUUID(), account.id);
  }

  @Post('purchase-orders/:id/send')
  @RequirePermissions('suppliers.update')
  async sendPurchaseOrder(
    @CurrentAccount() account: any,
    @Param('id') id: string
  ) {
    return this.suppliersService.sendPurchaseOrder(account.propertyId, id);
  }

  @Post('purchase-orders/:id/receive')
  @RequirePermissions('suppliers.update')
  async receivePurchaseOrder(
    @CurrentAccount() account: any,
    @Param('id') id: string,
    @Body() body: any,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    const dto = parseReceivePurchaseOrderDto(body);
    return this.suppliersService.receivePurchaseOrder(account.propertyId, id, dto, idempotencyKey || crypto.randomUUID(), account.id);
  }

  @Post(':id/rate')
  @RequirePermissions('suppliers.update')
  async rateSupplier(
    @CurrentAccount() account: any,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const dto = parseRateSupplierDto(body);
    return this.suppliersService.rateSupplier(account.propertyId, id, dto);
  }

  @Get()
  @RequirePermissions('suppliers.read')
  async listSuppliers(
    @CurrentAccount() account: any,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') query?: string,
    @Query('status') status?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '20', 10)));
    return this.suppliersService.listSuppliers(account.propertyId, { page, pageSize, ...(query ? { query } : {}), ...(status ? { status } : {}) });
  }

  @Get(':id')
  @RequirePermissions('suppliers.read')
  async getSupplier(
    @CurrentAccount() account: any,
    @Param('id') id: string
  ) {
    return this.suppliersService.getSupplier(account.propertyId, id);
  }

  @Get(':id/inventory')
  @RequirePermissions('suppliers.read')
  async getSupplierInventory(
    @CurrentAccount() account: any,
    @Param('id') id: string
  ) {
    return this.suppliersService.getSupplierInventory(account.propertyId, id);
  }

  @Post(':id/inventory/assign')
  @RequirePermissions('suppliers.update')
  async assignSupplierInventory(
    @CurrentAccount() account: any,
    @Param('id') id: string,
    @Body() body: any
  ) {
    const dto = parseAssignSupplierInventoryDto(body);
    return this.suppliersService.assignSupplierInventory(account.propertyId, id, dto.itemIds);
  }

  @Post(':id/restock')
  @RequirePermissions('suppliers.update')
  async restockFromSupplier(
    @CurrentAccount() account: any,
    @Param('id') id: string,
    @Body() body: any,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header is required');
    const dto = parseRestockFromSupplierDto(body);
    return this.suppliersService.restockFromSupplier(account.propertyId, id, dto, idempotencyKey, account.id);
  }

  @Post()
  @RequirePermissions('suppliers.create')
  async createSupplier(
    @CurrentAccount() account: any,
    @Body() body: any,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header is required');
    const dto = parseCreateSupplierDto(body);
    return this.suppliersService.createSupplier(account.propertyId, dto, idempotencyKey, account.id);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.update')
  async updateSupplier(
    @CurrentAccount() account: any,
    @Param('id') id: string,
    @Body() body: any,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header is required');
    const expectedVersion = body.expectedVersion;
    if (typeof expectedVersion !== 'number') throw new BadRequestException('expectedVersion is required');
    
    const dto = parseUpdateSupplierDto(body);
    return this.suppliersService.updateSupplier(account.propertyId, id, dto, expectedVersion, idempotencyKey, account.id);
  }

  @Post(':id/archive')
  @RequirePermissions('suppliers.archive')
  async archiveSupplier(
    @CurrentAccount() account: any,
    @Param('id') id: string,
    @Body() body: any,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header is required');
    const dto = parseArchiveSupplierDto(body);
    return this.suppliersService.archiveSupplier(account.propertyId, id, dto, idempotencyKey, account.id);
  }

  @Post(':id/reactivate')
  @RequirePermissions('suppliers.archive')
  async reactivateSupplier(
    @CurrentAccount() account: any,
    @Param('id') id: string,
    @Body() body: any,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header is required');
    const dto = parseReactivateSupplierDto(body);
    return this.suppliersService.reactivateSupplier(account.propertyId, id, dto, idempotencyKey, account.id);
  }
}
