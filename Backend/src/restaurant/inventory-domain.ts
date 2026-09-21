export interface InventoryRecipeIngredient {
  menuItemId: string;
  inventoryItemId: string;
  quantity: string | number;
  unit?: string | null;
}

export interface InventoryOrderLine {
  menuItemId: string;
  quantity: number;
}

export interface InventoryStockItem {
  id: string;
  unit?: string | null;
}

export interface InventoryRequirement {
  inventoryItemId: string;
  quantity: number;
}

export interface InventoryStockSnapshot {
  id: string;
  name: string;
  unit: string;
  stock: string | number;
  reserved: string | number;
}

export interface InventoryMutationPlan {
  update: { stock?: string; reserved?: string };
  ledger: { type: 'Reserva' | 'Consumo' | 'Devolucion'; quantity: string; note: string };
}

export interface InventoryInsufficientStock {
  kind: 'insufficient_stock';
  itemName: string;
  available: number;
  required: number;
  unit: string;
}

export function convertIngredientToInventoryUnit(qty: number, recipeUnit?: string | null, inventoryUnit?: string | null): number {
  if (!recipeUnit || !inventoryUnit) return qty;
  const rUnit = recipeUnit.toLowerCase().trim();
  const iUnit = inventoryUnit.toLowerCase().trim();
  if (rUnit === iUnit) return qty;

  if (rUnit === 'oz' || rUnit === 'onza' || rUnit === 'onzas') {
    if (iUnit.includes('750')) return qty / 25.3605;
    if (iUnit.includes('1000') || iUnit.includes('litro') || iUnit === 'l' || iUnit === 'lt') return qty / 33.814;
    if (iUnit === 'ml' || iUnit.includes('mili')) return qty * 29.5735;
    if (iUnit.includes('botella')) return qty / 25.3605;
  }

  if (rUnit === 'dash' || rUnit === 'gotas' || rUnit === 'golpe') {
    if (iUnit.includes('botella') || iUnit.includes('frasco')) return qty / 200;
    if (iUnit === 'ml') return qty * 0.92;
    if (iUnit === 'oz') return qty / 32;
  }

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

export function calculateInventoryRequirements(
  lines: readonly InventoryOrderLine[],
  ingredients: readonly InventoryRecipeIngredient[],
  stockItems: readonly InventoryStockItem[],
): InventoryRequirement[] {
  const ingredientsByMenuItemId = new Map<string, InventoryRecipeIngredient[]>();
  for (const ingredient of ingredients) {
    const itemIngredients = ingredientsByMenuItemId.get(ingredient.menuItemId) ?? [];
    itemIngredients.push(ingredient);
    ingredientsByMenuItemId.set(ingredient.menuItemId, itemIngredients);
  }

  const stockItemById = new Map(stockItems.map((item) => [item.id, item]));
  const requirementsByInventoryId = new Map<string, number>();
  for (const line of lines) {
    for (const ingredient of ingredientsByMenuItemId.get(line.menuItemId) ?? []) {
      const stockItem = stockItemById.get(ingredient.inventoryItemId);
      if (!stockItem) continue;
      const convertedPerPortion = convertIngredientToInventoryUnit(Number(ingredient.quantity), ingredient.unit, stockItem.unit);
      const needed = convertedPerPortion * line.quantity;
      requirementsByInventoryId.set(
        ingredient.inventoryItemId,
        (requirementsByInventoryId.get(ingredient.inventoryItemId) ?? 0) + needed,
      );
    }
  }

  return [...requirementsByInventoryId.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }));
}

export function planInventoryReservation(
  item: InventoryStockSnapshot,
  quantity: number,
  orderId: string,
): { ok: true; plan: InventoryMutationPlan } | { ok: false; failure: InventoryInsufficientStock } {
  const available = Number(item.stock) - Number(item.reserved);
  if (available < quantity) {
    return {
      ok: false,
      failure: { kind: 'insufficient_stock', itemName: item.name, available, required: quantity, unit: item.unit },
    };
  }
  return {
    ok: true,
    plan: {
      update: { reserved: (Number(item.reserved) + quantity).toFixed(4) },
      ledger: { type: 'Reserva', quantity: (-quantity).toFixed(4), note: `Reserva por comanda ${orderId}` },
    },
  };
}

export function planInventoryConsumption(item: InventoryStockSnapshot, quantity: number, orderId: string): InventoryMutationPlan {
  return {
    update: {
      stock: Math.max(0, Number(item.stock) - quantity).toFixed(4),
      reserved: Math.max(0, Number(item.reserved) - quantity).toFixed(4),
    },
    ledger: { type: 'Consumo', quantity: (-quantity).toFixed(4), note: `Consumo por comanda ${orderId}` },
  };
}

export function planInventoryRelease(item: InventoryStockSnapshot, quantity: number, orderId: string): InventoryMutationPlan {
  return {
    update: { reserved: Math.max(0, Number(item.reserved) - quantity).toFixed(4) },
    ledger: { type: 'Devolucion', quantity: quantity.toFixed(4), note: `Devolucion por cancelacion de pedido ${orderId}` },
  };
}
