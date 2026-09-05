// ─── Menu Item Adapters ───────────────────────────────────────────────────────
export function adaptMenuItem(raw) {
  if (!raw) return null;
  const variants = (raw.variants ?? []).map((v) => ({
    id: v.id,
    name: v.name ?? null,
    price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
    currency: v.currency ?? 'PEN',
    position: v.position ?? 0,
    status: v.status ?? 'active',
    isPublished: v.isPublished ?? true,
    isAvailable: v.isAvailable ?? true,
  }));
  return {
    id: raw.id,
    propertyId: raw.propertyId,
    name: raw.name,
    category: raw.category,
    categoryId: raw.categoryId ?? null,
    position: raw.position ?? 0,
    salePrice: raw.salePrice !== null && raw.salePrice !== undefined ? Number(raw.salePrice) : null,
    currency: raw.currency ?? 'PEN',
    description: raw.description ?? '',
    preparationMinutes: raw.preparationMinutes ?? 10,
    status: raw.status,
    isPublished: raw.isPublished ?? true,
    isAvailable: raw.isAvailable ?? true,
    // Management mode — 'manual' | 'imported'
    managementMode: raw.managementMode ?? 'manual',
    isManaged: raw.managementMode === 'imported',
    // Source traceability (present on imported items)
    sourceSystem: raw.sourceSystem ?? null,
    sourceKey: raw.sourceKey ?? null,
    sourceHash: raw.sourceHash ?? null,
    lastImportRunId: raw.lastImportRunId ?? null,
    // Operational stock signals (from internal/menu)
    stockAvailable: raw.stockAvailable !== undefined ? Number(raw.stockAvailable) : null,
    maxAvailableQuantity: raw.maxAvailableQuantity !== undefined ? Number(raw.maxAvailableQuantity) : null,
    ingredients: (raw.ingredients ?? []).map((ing) => ({
      id: ing.id,
      inventoryItemId: ing.inventoryItemId,
      quantity: Number(ing.quantity),
    })),
    variants,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function adaptMenuList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(adaptMenuItem).filter(Boolean);
}

// Full admin catalogue — includes hidden/archived/imported items
export const adaptManagedMenuList = adaptMenuList;

/**
 * Returns the display price for a menu item.
 * For items with variants: price of the first active/published/available variant.
 * For items without variants: salePrice.
 * Returns null if no usable price exists.
 */
export function getItemDisplayPrice(item) {
  if (!item) return null;
  if (item.variants && item.variants.length > 0) {
    const active = item.variants.find(
      (v) => v.status === 'active' && v.isPublished && v.isAvailable && v.price !== null && v.price > 0,
    );
    return active?.price ?? null;
  }
  return item.salePrice && item.salePrice > 0 ? item.salePrice : null;
}

// ─── Inventory Item Adapters ──────────────────────────────────────────────────
export function adaptInventoryItem(raw) {
  if (!raw) return null;
  const stock = Number(raw.stock) || 0;
  const reserved = Number(raw.reserved) || 0;
  const available = Math.round((stock - reserved) * 10000) / 10000;
  const minimum = Number(raw.minimum) || 0;
  const cost = Number(raw.cost) || 0;
  const totalValue = Math.round(stock * cost * 100) / 100;
  const isCritical = available <= 0;
  const isLow = available <= minimum && available > 0;
  const healthPercent = minimum > 0 ? Math.min(100, Math.max(0, Math.round((available / minimum) * 100))) : 100;

  return {
    id: raw.id,
    propertyId: raw.propertyId,
    name: raw.name,
    unit: raw.unit,
    lot: raw.lot ?? null,
    stock,
    reserved,
    available,
    minimum,
    cost,
    totalValue,
    supplierId: raw.supplierId ?? null,
    supplierName: raw.supplierName ?? null,
    status: raw.status,
    isLow,
    isCritical,
    healthPercent,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function adaptInventoryList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(adaptInventoryItem).filter(Boolean);
}

export function adaptLedgerEntry(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    inventoryItemId: raw.inventoryItemId,
    type: raw.type,
    quantity: Number(raw.quantity),
    referenceId: raw.referenceId ?? null,
    note: raw.note ?? '',
    responsible: raw.responsible,
    createdAt: raw.createdAt,
  };
}

export function adaptLedgerList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(adaptLedgerEntry).filter(Boolean);
}

// ─── Order Adapters ───────────────────────────────────────────────────────────
export function adaptOrder(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    propertyId: raw.propertyId,
    source: raw.source,
    stayId: raw.stayId ?? null,
    status: raw.status,
    inventoryStage: raw.inventoryStage,
    accountingStage: raw.accountingStage,
    paymentMethod: raw.paymentMethod,
    total: Number(raw.total),
    estimatedMinutes: raw.estimatedMinutes,
    comment: raw.comment ?? '',
    responsible: raw.responsible,
    cancelReason: raw.cancelReason ?? null,
    items: (raw.items ?? []).map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      variantId: item.menuItemVariantId ?? null,
      name: item.menuItemName,
      variantName: item.menuItemVariantName ?? null,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
    })),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function adaptOrdersList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(adaptOrder).filter(Boolean);
}

// ─── Menu Import Result Adapter ───────────────────────────────────────────────
/**
 * Maps a MenuImportResult from the server (preview or apply response) to a
 * stable frontend model. Both endpoints return the same shape.
 */
export function adaptImportPreviewResult(raw) {
  if (!raw) return null;
  const mapCounts = (entity) => ({
    created: entity?.created ?? 0,
    updated: entity?.updated ?? 0,
    unchanged: entity?.unchanged ?? 0,
    unpublished: entity?.unpublished ?? 0,
    total: entity?.total ?? 0,
  });
  return {
    runId: raw.runId ?? null,
    mode: raw.mode ?? null,
    sourceSystem: raw.sourceSystem ?? null,
    sourceDigest: raw.sourceDigest ?? null,
    currency: raw.currency ?? 'PEN',
    source: raw.source ?? null,
    categories: mapCounts(raw.categories),
    items: mapCounts(raw.items),
    variants: mapCounts(raw.variants),
  };
}
