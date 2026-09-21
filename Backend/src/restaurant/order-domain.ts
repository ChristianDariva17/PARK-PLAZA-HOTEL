export type OrderStation = 'bar' | 'coffee' | 'kitchen';

export interface OrderMenuItem {
  id: string;
  name: string;
  category?: string | null;
  salePrice: string | number | null;
}

export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  station?: OrderStation | undefined;
  notes?: string | null | undefined;
}

export interface RestaurantOrderLine {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  station: OrderStation;
  status: 'recibido';
  notes: string | null;
}

export interface OrderPricingPlan {
  lines: RestaurantOrderLine[];
  total: string;
}

export const ORDER_FLOW = [
  'Pedido recibido',
  'Confirmado',
  'En preparacion',
  'Listo',
  'Entregado',
  'Pagado',
] as const;

export type OrderStatus = (typeof ORDER_FLOW)[number];

export type OrderAdvanceFailure =
  | { kind: 'stale'; expectedStatus: string; currentStatus: string }
  | { kind: 'cannot_advance'; currentStatus: string }
  | { kind: 'financially_terminal'; currentStatus: 'Entregado' };

export function planOrderAdvance(input: {
  currentStatus: string;
  expectedStatus: string;
  stayId?: string | null;
}): { ok: true; nextStatus: OrderStatus } | { ok: false; failure: OrderAdvanceFailure } {
  if (input.currentStatus !== input.expectedStatus) {
    return {
      ok: false,
      failure: { kind: 'stale', expectedStatus: input.expectedStatus, currentStatus: input.currentStatus },
    };
  }

  const currentIndex = ORDER_FLOW.indexOf(input.currentStatus as OrderStatus);
  if (currentIndex < 0 || currentIndex >= ORDER_FLOW.length - 1) {
    return { ok: false, failure: { kind: 'cannot_advance', currentStatus: input.currentStatus } };
  }
  if (input.stayId && input.currentStatus === 'Entregado') {
    return { ok: false, failure: { kind: 'financially_terminal', currentStatus: 'Entregado' } };
  }

  return { ok: true, nextStatus: ORDER_FLOW[currentIndex + 1]! };
}

export function determineStation(category?: string | null): OrderStation {
  if (!category) return 'kitchen';
  const normalized = category.toLowerCase().trim();
  if (normalized.includes('bar') || normalized.includes('tiki') || normalized.includes('autor') || normalized.includes('cerveza') || normalized.includes('gaseosa') || normalized.includes('bebida') || normalized.includes('refresco')) {
    return 'bar';
  }
  if (normalized.includes('café') || normalized.includes('cafe') || normalized.includes('infusion') || normalized.includes('frappe')) {
    return 'coffee';
  }
  return 'kitchen';
}

export function planOrderPricing(
  items: readonly OrderLineInput[],
  menuItems: readonly OrderMenuItem[],
): OrderPricingPlan {
  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  let total = 0;
  const lines = items.map((item) => {
    const menu = menuById.get(item.menuItemId);
    if (!menu) throw new Error(`Missing menu item: ${item.menuItemId}`);

    const subtotal = Number(menu.salePrice) * item.quantity;
    total += subtotal;
    return {
      menuItemId: item.menuItemId,
      menuItemName: menu.name,
      quantity: item.quantity,
      unitPrice: Number(menu.salePrice).toFixed(2),
      subtotal: subtotal.toFixed(2),
      station: item.station ?? determineStation(menu.category),
      status: 'recibido' as const,
      notes: item.notes ?? null,
    };
  });

  return { lines, total: total.toFixed(2) };
}
