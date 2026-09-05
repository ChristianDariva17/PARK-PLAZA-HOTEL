import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException, Inject, OnModuleInit } from '@nestjs/common';
import { DATABASE, type Database } from '../database/database.module.js';
import { suppliers, supplierCommands, supplierBankDetails, purchaseOrders } from '../database/schema/suppliers.schema.js';
import { inventoryItems, inventoryLedger } from '../database/schema/restaurant.schema.js';
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { 
  CreateSupplierDto, 
  UpdateSupplierDto, 
  ArchiveSupplierDto, 
  ReactivateSupplierDto,
  AssignSupplierInventoryDto,
  RestockFromSupplierDto,
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
  RateSupplierDto
} from './suppliers.dto.js';
import { randomUUID } from 'crypto';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class SuppliersService implements OnModuleInit {
  private readonly logger = new Logger(SuppliersService.name);
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async onModuleInit() {
    try {
      // Ensure purchase_orders table and rating columns exist safely
      await (this.db as any).execute(sql`
        ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rating integer DEFAULT 5;
        ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rating_notes text;

        CREATE TABLE IF NOT EXISTS purchase_orders (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id uuid NOT NULL REFERENCES properties(id),
          supplier_id uuid NOT NULL REFERENCES suppliers(id),
          order_number varchar(40) NOT NULL,
          status varchar(30) NOT NULL DEFAULT 'draft',
          expected_delivery_date timestamp,
          currency varchar(3) NOT NULL DEFAULT 'PEN',
          subtotal numeric(12, 2) NOT NULL DEFAULT 0,
          tax numeric(12, 2) NOT NULL DEFAULT 0,
          total numeric(12, 2) NOT NULL DEFAULT 0,
          items jsonb NOT NULL DEFAULT '[]',
          notes text,
          invoice_number varchar(80),
          rating integer,
          rating_notes text,
          issued_by_account_id uuid,
          sent_at timestamp,
          received_at timestamp,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(property_id, supplier_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(property_id, status);
      `);
      this.logger.log('Suppliers and Purchase Orders schema verified successfully');
    } catch (e) {
      this.logger.warn('Suppliers schema check warning: ' + (e as Error).message);
    }
  }

  async listSuppliers(propertyId: string, options: { page: number; pageSize: number; query?: string; status?: string }) {
    let conditions = [eq(suppliers.propertyId, propertyId)];
    
    if (options.status) {
      conditions.push(eq(suppliers.status, options.status));
    }
    
    if (options.query) {
      const q = `%${options.query.toUpperCase().replace(/\s+/g, '')}%`;
      conditions.push(sql`${suppliers.legalNameNormalized} LIKE ${q} OR ${suppliers.taxIdNormalized} LIKE ${q}`);
    }

    const items = await this.db.select()
      .from(suppliers)
      .where(and(...conditions))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize)
      .orderBy(suppliers.legalNameNormalized, suppliers.id);
      
    const countRes = await this.db.select({ count: sql<number>`count(*)` }).from(suppliers).where(and(...conditions));
    
    // Fetch count of inventory items per supplier
    const allInv = await this.db.select({
      supplierId: inventoryItems.supplierId,
      count: sql<number>`count(*)`,
    })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.propertyId, propertyId), eq(inventoryItems.status, 'active')))
    .groupBy(inventoryItems.supplierId);

    const invCountMap = new Map<string, number>();
    allInv.forEach(row => {
      if (row.supplierId) invCountMap.set(row.supplierId, Number(row.count));
    });

    return {
      items: items.map(s => ({
        ...this.mapToResponse(s),
        suppliedItemsCount: invCountMap.get(s.id) || 0,
      })),
      total: Number(countRes?.[0]?.count ?? 0),
      page: options.page,
      pageSize: options.pageSize
    };
  }

  async getSupplier(propertyId: string, id: string) {
    const [supplier] = await this.db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.propertyId, propertyId)));
    if (!supplier) throw new NotFoundException('Supplier not found');

    const inventory = await this.db.select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.supplierId, id),
        eq(inventoryItems.status, 'active')
      ))
      .orderBy(inventoryItems.name);

    return {
      ...this.mapToResponse(supplier),
      inventory,
      suppliedItemsCount: inventory.length,
    };
  }

  async getSupplierInventory(propertyId: string, supplierId: string) {
    const [supplier] = await this.db.select().from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.propertyId, propertyId)));
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.db.select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.supplierId, supplierId),
        eq(inventoryItems.status, 'active')
      ))
      .orderBy(inventoryItems.name);
  }

  async assignSupplierInventory(propertyId: string, supplierId: string, itemIds: string[]) {
    const [supplier] = await this.db.select().from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.propertyId, propertyId)));
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.db.transaction(async (tx: Transaction) => {
      await tx.update(inventoryItems)
        .set({ supplierId: null, updatedAt: new Date() })
        .where(and(eq(inventoryItems.propertyId, propertyId), eq(inventoryItems.supplierId, supplierId)));

      if (itemIds.length > 0) {
        await tx.update(inventoryItems)
          .set({ supplierId, updatedAt: new Date() })
          .where(and(eq(inventoryItems.propertyId, propertyId), inArray(inventoryItems.id, itemIds)));
      }

      return this.db.select()
        .from(inventoryItems)
        .where(and(
          eq(inventoryItems.propertyId, propertyId),
          eq(inventoryItems.supplierId, supplierId),
          eq(inventoryItems.status, 'active')
        ))
        .orderBy(inventoryItems.name);
    });
  }

  // ─── Reorder Suggestions (Low Stock Detection) ──────────────────────────────
  async getReorderSuggestions(propertyId: string) {
    // Select active items where stock <= minimum (or minimum > 0 and stock < minimum * 1.5)
    const items = await this.db.select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.status, 'active')
      ))
      .orderBy(inventoryItems.name);

    const allSuppliers = await this.db.select()
      .from(suppliers)
      .where(and(eq(suppliers.propertyId, propertyId), eq(suppliers.status, 'active')));

    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]));

    const criticalItems = items
      .filter(item => Number(item.stock || 0) <= Number(item.minimum || 0))
      .map(item => {
        const stock = Number(item.stock || 0);
        const minimum = Number(item.minimum || 1);
        const cost = Number(item.cost || 0);
        const suggestedQty = Math.max(minimum * 2 - stock, minimum);
        const sup = item.supplierId ? supplierMap.get(item.supplierId) : null;

        return {
          id: item.id,
          name: item.name,
          unit: item.unit,
          stock,
          minimum,
          cost,
          suggestedQuantity: Math.ceil(suggestedQty),
          estimatedTotalCost: Number((suggestedQty * cost).toFixed(2)),
          supplierId: item.supplierId || null,
          supplierName: sup ? (sup.tradeName || sup.legalName) : 'Sin proveedor asignado',
          supplierEmail: sup?.email || null,
          supplierPhone: sup?.phone || null,
          isPreferredSupplier: Boolean(sup?.isPreferred),
        };
      });

    return {
      count: criticalItems.length,
      criticalItems,
    };
  }

  // ─── Purchase Orders (Órdenes de Compra) ──────────────────────────────────
  async createPurchaseOrder(propertyId: string, dto: CreatePurchaseOrderDto, idempotencyKey: string, accountId: string) {
    const [supplier] = await this.db.select().from(suppliers).where(and(eq(suppliers.id, dto.supplierId), eq(suppliers.propertyId, propertyId)));
    if (!supplier) throw new NotFoundException('Supplier not found');

    const countRes = await this.db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.propertyId, propertyId));
    const nextSeq = Number(countRes?.[0]?.count ?? 0) + 1;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const orderNumber = `OC-${yearMonth}-${String(nextSeq).padStart(4, '0')}`;

    let subtotal = 0;
    const computedItems = dto.items.map(item => {
      const lineTotal = Number((item.quantity * (item.unitCost || 0)).toFixed(2));
      subtotal += lineTotal;
      return {
        inventoryItemId: item.inventoryItemId,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: lineTotal,
      };
    });

    const tax = Number((subtotal * 0.18).toFixed(2)); // IGV 18%
    const total = Number((subtotal + tax).toFixed(2));

    const [created] = await this.db.insert(purchaseOrders).values({
      id: randomUUID(),
      propertyId,
      supplierId: dto.supplierId,
      orderNumber,
      status: 'draft',
      expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
      currency: dto.currency || 'PEN',
      subtotal: String(subtotal.toFixed(2)),
      tax: String(tax.toFixed(2)),
      total: String(total.toFixed(2)),
      items: computedItems as any,
      notes: dto.notes ?? null,
      issuedByAccountId: accountId as any,
    }).returning();

    return {
      ...created,
      supplier: this.mapToResponse(supplier),
    };
  }

  async listPurchaseOrders(propertyId: string, options: { supplierId?: string; status?: string }) {
    let conditions = [eq(purchaseOrders.propertyId, propertyId)];
    if (options.supplierId) conditions.push(eq(purchaseOrders.supplierId, options.supplierId));
    if (options.status) conditions.push(eq(purchaseOrders.status, options.status));

    const ordersList = await this.db.select()
      .from(purchaseOrders)
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt));

    const allSuppliers = await this.db.select().from(suppliers).where(eq(suppliers.propertyId, propertyId));
    const supMap = new Map(allSuppliers.map(s => [s.id, s]));

    return ordersList.map(po => ({
      ...po,
      supplier: po.supplierId && supMap.has(po.supplierId) ? this.mapToResponse(supMap.get(po.supplierId)!) : null,
    }));
  }

  async getPurchaseOrder(propertyId: string, orderId: string) {
    const [po] = await this.db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.propertyId, propertyId)));
    if (!po) throw new NotFoundException('Purchase order not found');

    const [supplier] = await this.db.select().from(suppliers).where(and(eq(suppliers.id, po.supplierId), eq(suppliers.propertyId, propertyId)));

    return {
      ...po,
      supplier: supplier ? this.mapToResponse(supplier) : null,
    };
  }

  async sendPurchaseOrder(propertyId: string, orderId: string) {
    const [po] = await this.db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.propertyId, propertyId)));
    if (!po) throw new NotFoundException('Purchase order not found');

    const [updated] = await this.db.update(purchaseOrders)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(purchaseOrders.id, orderId))
      .returning();

    return updated;
  }

  async receivePurchaseOrder(propertyId: string, orderId: string, dto: ReceivePurchaseOrderDto, idempotencyKey: string, accountId: string) {
    return this.db.transaction(async (tx: Transaction) => {
      const [po] = await tx.select().from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.propertyId, propertyId)))
        .for('update');

      if (!po) throw new NotFoundException('Purchase order not found');
      if (po.status === 'received') throw new ConflictException('Purchase order has already been received.');

      const [supplier] = await tx.select().from(suppliers)
        .where(and(eq(suppliers.id, po.supplierId), eq(suppliers.propertyId, propertyId)));

      const items = (po.items as any[]) || [];
      const updatedInventoryResults = [];

      for (const itm of items) {
        const [inv] = await tx.select().from(inventoryItems)
          .where(and(eq(inventoryItems.id, itm.inventoryItemId), eq(inventoryItems.propertyId, propertyId)))
          .for('update');

        if (inv) {
          const currentStock = Number(inv.stock || 0);
          const newStock = currentStock + Number(itm.quantity);

          const [updatedInv] = await tx.update(inventoryItems)
            .set({
              stock: String(newStock.toFixed(4)),
              cost: itm.unitCost ? String(Number(itm.unitCost).toFixed(2)) : inv.cost,
              supplierId: po.supplierId,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, itm.inventoryItemId))
            .returning();

          await tx.insert(inventoryLedger).values({
            id: randomUUID(),
            propertyId,
            inventoryItemId: itm.inventoryItemId,
            type: 'PURCHASE_ORDER_RECEIPT',
            quantity: String(Number(itm.quantity).toFixed(4)),
            referenceId: po.orderNumber,
            note: `Recepción Orden de Compra ${po.orderNumber} | Proveedor: ${supplier?.tradeName || supplier?.legalName || 'N/A'}${dto.invoiceNumber ? ` | Factura: ${dto.invoiceNumber}` : ''}`.slice(0, 300),
            responsible: accountId || 'hotel_system',
          });

          updatedInventoryResults.push(updatedInv);
        }
      }

      // If rating provided, update supplier rating
      if (dto.rating) {
        await tx.update(suppliers)
          .set({
            rating: dto.rating,
            ratingNotes: dto.ratingNotes || supplier?.ratingNotes,
            updatedAt: new Date(),
          })
          .where(eq(suppliers.id, po.supplierId));
      }

      const [updatedPO] = await tx.update(purchaseOrders)
        .set({
          status: 'received',
          receivedAt: new Date(),
          invoiceNumber: dto.invoiceNumber || po.invoiceNumber,
          rating: dto.rating ?? po.rating,
          ratingNotes: dto.ratingNotes ?? po.ratingNotes,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, orderId))
        .returning();

      return {
        purchaseOrder: updatedPO,
        restockedItems: updatedInventoryResults,
      };
    });
  }

  async rateSupplier(propertyId: string, supplierId: string, dto: RateSupplierDto) {
    const [supplier] = await this.db.select().from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.propertyId, propertyId)));
    if (!supplier) throw new NotFoundException('Supplier not found');

    const [updated] = await this.db.update(suppliers)
      .set({
        rating: dto.rating,
        ratingNotes: dto.ratingNotes ?? supplier.ratingNotes,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId))
      .returning();

    return this.mapToResponse(updated);
  }

  // ─── Core Suppliers CRUD ──────────────────────────────────────────────────
  async restockFromSupplier(propertyId: string, supplierId: string, dto: RestockFromSupplierDto, idempotencyKey: string, accountId: string) {
    const reqFingerprint = JSON.stringify(dto);

    return this.db.transaction(async (tx: Transaction) => {
      const [existingCommand] = await tx.select().from(supplierCommands)
        .where(and(
          eq(supplierCommands.propertyId, propertyId),
          eq(supplierCommands.operation, `restock_${supplierId}`),
          eq(supplierCommands.idempotencyKey, idempotencyKey)
        )).for('update');
        
      if (existingCommand) {
        return JSON.parse(existingCommand.response!);
      }

      const [supplier] = await tx.select().from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.propertyId, propertyId)));
      if (!supplier) throw new NotFoundException('Supplier not found');

      const restockedResults = [];

      for (const item of dto.items) {
        const [invItem] = await tx.select().from(inventoryItems)
          .where(and(eq(inventoryItems.id, item.inventoryItemId), eq(inventoryItems.propertyId, propertyId)))
          .for('update');

        if (!invItem) {
          throw new NotFoundException(`Insumo de inventario ${item.inventoryItemId} no encontrado`);
        }

        const currentStock = Number(invItem.stock || 0);
        const addedQty = Number(item.quantity);
        const newStock = currentStock + addedQty;

        const updateFields: any = {
          stock: String(newStock.toFixed(4)),
          supplierId,
          updatedAt: new Date(),
        };

        if (item.unitCost !== undefined) {
          updateFields.cost = String(Number(item.unitCost).toFixed(2));
        }
        if (item.lot) {
          updateFields.lot = item.lot;
        }

        const [updatedInv] = await tx.update(inventoryItems)
          .set(updateFields)
          .where(eq(inventoryItems.id, item.inventoryItemId))
          .returning();

        const ledgerNote = `Ingreso por Reabastecimiento Proveedor: ${supplier.tradeName || supplier.legalName}${dto.invoiceNumber ? ` · Factura: ${dto.invoiceNumber}` : ''}${dto.notes ? ` · ${dto.notes}` : ''}`;

        await tx.insert(inventoryLedger).values({
          id: randomUUID(),
          propertyId,
          inventoryItemId: item.inventoryItemId,
          type: 'PURCHASE_RECEIPT',
          quantity: String(addedQty.toFixed(4)),
          referenceId: supplierId,
          note: ledgerNote.slice(0, 300),
          responsible: accountId || 'hotel_system',
        });

        restockedResults.push(updatedInv);
      }

      const response = {
        success: true,
        restockedCount: restockedResults.length,
        supplier: this.mapToResponse(supplier),
        items: restockedResults,
      };

      await tx.insert(supplierCommands).values({
        propertyId,
        operation: `restock_${supplierId}`,
        idempotencyKey,
        requestFingerprint: reqFingerprint,
        responseStatus: 200,
        response: JSON.stringify(response)
      });

      return response;
    });
  }

  async createSupplier(propertyId: string, dto: CreateSupplierDto, idempotencyKey: string, accountId: string) {
    const reqFingerprint = JSON.stringify(dto);
    const taxIdNormalized = dto.taxId.replace(/[^0-9]/g, '');
    const legalNameNormalized = dto.legalName.trim().replace(/\s+/g, ' ').toUpperCase();

    return this.db.transaction(async (tx: Transaction) => {
      const [existingCommand] = await tx.select().from(supplierCommands)
        .where(and(
          eq(supplierCommands.propertyId, propertyId),
          eq(supplierCommands.operation, 'create'),
          eq(supplierCommands.idempotencyKey, idempotencyKey)
        )).for('update');
        
      if (existingCommand) {
        if (existingCommand.requestFingerprint !== reqFingerprint) {
          throw new ConflictException('Idempotency key reused with different request body');
        }
        return JSON.parse(existingCommand.response!);
      }

      const id = randomUUID();
      try {
        const [inserted] = await tx.insert(suppliers).values({
          id,
          propertyId,
          legalName: dto.legalName,
          legalNameNormalized,
          taxId: dto.taxId,
          taxIdNormalized,
          tradeName: dto.tradeName,
          contactName: dto.contactName,
          phone: dto.phone,
          email: dto.email,
          categories: dto.categories,
          averageDeliveryDays: dto.averageDeliveryDays,
          isPreferred: dto.isPreferred,
          rating: dto.rating ?? 5,
          ratingNotes: dto.ratingNotes ?? null,
          status: 'active',
          version: 1
        }).returning();

        if (dto.inventoryItemIds && dto.inventoryItemIds.length > 0) {
          await tx.update(inventoryItems)
            .set({ supplierId: id, updatedAt: new Date() })
            .where(and(eq(inventoryItems.propertyId, propertyId), inArray(inventoryItems.id, dto.inventoryItemIds)));
        }

        const response = this.mapToResponse(inserted);

        await tx.insert(supplierCommands).values({
          propertyId,
          operation: 'create',
          idempotencyKey,
          requestFingerprint: reqFingerprint,
          responseStatus: 201,
          response: JSON.stringify(response)
        });
        
        return response;
      } catch (err: any) {
        if (err.code === '23505') {
          throw new ConflictException('SUPPLIER_TAX_ID_CONFLICT');
        }
        throw err;
      }
    });
  }

  async updateSupplier(propertyId: string, id: string, dto: UpdateSupplierDto, expectedVersion: number, idempotencyKey: string, accountId: string) {
    const reqFingerprint = JSON.stringify({ ...dto, expectedVersion });

    return this.db.transaction(async (tx: Transaction) => {
      const [existingCommand] = await tx.select().from(supplierCommands)
        .where(and(
          eq(supplierCommands.propertyId, propertyId),
          eq(supplierCommands.operation, `update_${id}`),
          eq(supplierCommands.idempotencyKey, idempotencyKey)
        )).for('update');
        
      if (existingCommand) {
        if (existingCommand.requestFingerprint !== reqFingerprint) {
          throw new ConflictException('Idempotency key reused with different request body');
        }
        return JSON.parse(existingCommand.response!);
      }

      const [supplier] = await tx.select().from(suppliers)
        .where(and(eq(suppliers.id, id), eq(suppliers.propertyId, propertyId)))
        .for('update');
        
      if (!supplier) throw new NotFoundException('Supplier not found');
      if (supplier.status !== 'active') throw new ConflictException('Cannot edit archived supplier');
      if (supplier.version !== expectedVersion) throw new ConflictException('SUPPLIER_VERSION_CONFLICT');

      let updates: any = { version: supplier.version + 1, updatedAt: new Date() };
      if (dto.legalName) {
        updates.legalName = dto.legalName;
        updates.legalNameNormalized = dto.legalName.trim().replace(/\s+/g, ' ').toUpperCase();
      }
      if (dto.taxId) {
        updates.taxId = dto.taxId;
        updates.taxIdNormalized = dto.taxId.replace(/[^0-9]/g, '');
      }
      if (dto.tradeName !== undefined) updates.tradeName = dto.tradeName;
      if (dto.contactName !== undefined) updates.contactName = dto.contactName;
      if (dto.phone !== undefined) updates.phone = dto.phone;
      if (dto.email !== undefined) updates.email = dto.email;
      if (dto.categories !== undefined) updates.categories = dto.categories;
      if (dto.averageDeliveryDays !== undefined) updates.averageDeliveryDays = dto.averageDeliveryDays;
      if (dto.isPreferred !== undefined) updates.isPreferred = dto.isPreferred;
      if (dto.rating !== undefined) updates.rating = dto.rating;
      if (dto.ratingNotes !== undefined) updates.ratingNotes = dto.ratingNotes;

      try {
        const [updated] = await tx.update(suppliers)
          .set(updates)
          .where(eq(suppliers.id, id))
          .returning();

        if (dto.inventoryItemIds !== undefined) {
          await tx.update(inventoryItems)
            .set({ supplierId: null, updatedAt: new Date() })
            .where(and(eq(inventoryItems.propertyId, propertyId), eq(inventoryItems.supplierId, id)));

          if (dto.inventoryItemIds.length > 0) {
            await tx.update(inventoryItems)
              .set({ supplierId: id, updatedAt: new Date() })
              .where(and(eq(inventoryItems.propertyId, propertyId), inArray(inventoryItems.id, dto.inventoryItemIds)));
          }
        }
          
        const response = this.mapToResponse(updated);

        await tx.insert(supplierCommands).values({
          propertyId,
          operation: `update_${id}`,
          idempotencyKey,
          requestFingerprint: reqFingerprint,
          responseStatus: 200,
          response: JSON.stringify(response)
        });

        return response;
      } catch (err: any) {
        if (err.code === '23505') throw new ConflictException('SUPPLIER_TAX_ID_CONFLICT');
        throw err;
      }
    });
  }

  async archiveSupplier(propertyId: string, id: string, dto: ArchiveSupplierDto, idempotencyKey: string, accountId: string) {
    const reqFingerprint = JSON.stringify(dto);
    
    return this.db.transaction(async (tx: Transaction) => {
      const [existingCommand] = await tx.select().from(supplierCommands)
        .where(and(
          eq(supplierCommands.propertyId, propertyId),
          eq(supplierCommands.operation, `archive_${id}`),
          eq(supplierCommands.idempotencyKey, idempotencyKey)
        )).for('update');
        
      if (existingCommand) return JSON.parse(existingCommand.response!);

      const [supplier] = await tx.select().from(suppliers)
        .where(and(eq(suppliers.id, id), eq(suppliers.propertyId, propertyId)))
        .for('update');
        
      if (!supplier) throw new NotFoundException('Supplier not found');
      if (supplier.status !== 'active') throw new ConflictException('Supplier already archived');
      if (supplier.version !== dto.expectedVersion) throw new ConflictException('SUPPLIER_VERSION_CONFLICT');

      const [activeItem] = await tx.select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(and(
          eq(inventoryItems.propertyId, propertyId),
          eq(inventoryItems.supplierId, id),
          eq(inventoryItems.status, 'active')
        ))
        .limit(1);

      if (activeItem) {
        throw new ConflictException('No se puede archivar un proveedor asociado a ítems de inventario activos');
      }

      const [updated] = await tx.update(suppliers)
        .set({ 
          status: 'archived', 
          version: supplier.version + 1,
          updatedAt: new Date(),
          archivedAt: new Date(),
          archivedByAccountId: accountId
        })
        .where(eq(suppliers.id, id))
        .returning();

      const response = this.mapToResponse(updated);

      await tx.insert(supplierCommands).values({
        propertyId,
        operation: `archive_${id}`,
        idempotencyKey,
        requestFingerprint: reqFingerprint,
        responseStatus: 200,
        response: JSON.stringify(response)
      });
      return response;
    });
  }

  async reactivateSupplier(propertyId: string, id: string, dto: ReactivateSupplierDto, idempotencyKey: string, accountId: string) {
    const reqFingerprint = JSON.stringify(dto);
    
    return this.db.transaction(async (tx: Transaction) => {
      const [existingCommand] = await tx.select().from(supplierCommands)
        .where(and(
          eq(supplierCommands.propertyId, propertyId),
          eq(supplierCommands.operation, `reactivate_${id}`),
          eq(supplierCommands.idempotencyKey, idempotencyKey)
        )).for('update');
        
      if (existingCommand) return JSON.parse(existingCommand.response!);

      const [supplier] = await tx.select().from(suppliers)
        .where(and(eq(suppliers.id, id), eq(suppliers.propertyId, propertyId)))
        .for('update');
        
      if (!supplier) throw new NotFoundException('Supplier not found');
      if (supplier.status !== 'archived') throw new ConflictException('Supplier is not archived');
      if (supplier.version !== dto.expectedVersion) throw new ConflictException('SUPPLIER_VERSION_CONFLICT');

      try {
        const [updated] = await tx.update(suppliers)
          .set({ 
            status: 'active', 
            version: supplier.version + 1,
            updatedAt: new Date(),
            archivedAt: null,
            archivedByAccountId: null
          })
          .where(eq(suppliers.id, id))
          .returning();

        const response = this.mapToResponse(updated);

        await tx.insert(supplierCommands).values({
          propertyId,
          operation: `reactivate_${id}`,
          idempotencyKey,
          requestFingerprint: reqFingerprint,
          responseStatus: 200,
          response: JSON.stringify(response)
        });
        return response;
      } catch (err: any) {
         if (err.code === '23505') throw new ConflictException('SUPPLIER_TAX_ID_CONFLICT');
         throw err;
      }
    });
  }

  private mapToResponse(row: any) {
    return {
      id: row.id,
      legalName: row.legalName,
      taxId: row.taxId,
      tradeName: row.tradeName,
      contactName: row.contactName,
      phone: row.phone,
      email: row.email,
      categories: row.categories || [],
      averageDeliveryDays: row.averageDeliveryDays,
      isPreferred: row.isPreferred,
      rating: row.rating !== undefined && row.rating !== null ? row.rating : 5,
      ratingNotes: row.ratingNotes || null,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
