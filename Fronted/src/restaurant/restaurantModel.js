// ─── Menu Item Adapters ───────────────────────────────────────────────────────
export function adaptMenuItem(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    propertyId: raw.propertyId,
    name: raw.name,
    category: raw.category,
    salePrice: Number(raw.salePrice),
    description: raw.description ?? '',
    preparationMinutes: raw.preparationMinutes ?? 10,
    status: raw.status,
    ingredients: (raw.ingredients ?? []).map((ing) => ({
      id: ing.id,
      inventoryItemId: ing.inventoryItemId,
      quantity: Number(ing.quantity),
    })),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function adaptMenuList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(adaptMenuItem).filter(Boolean);
}

// ─── Inventory Item Adapters ──────────────────────────────────────────────────
export function adaptInventoryItem(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    propertyId: raw.propertyId,
    name: raw.name,
    unit: raw.unit,
    lot: raw.lot ?? null,
    stock: Number(raw.stock),
    reserved: Number(raw.reserved),
    available: Number(raw.stock) - Number(raw.reserved),
    minimum: Number(raw.minimum),
    cost: Number(raw.cost),
    supplierId: raw.supplierId ?? null,
    status: raw.status,
    isLow: Number(raw.stock) - Number(raw.reserved) <= Number(raw.minimum),
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
      name: item.menuItemName,
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
