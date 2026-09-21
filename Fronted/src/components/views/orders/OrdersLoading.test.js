import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ordersViewSource = readFileSync(new URL('./OrdersView.jsx', import.meta.url), 'utf8');

describe('Orders initial loading contract', () => {
  it('uses a structural accessible skeleton for the first kanban load', () => {
    expect(ordersViewSource).toContain('function OrdersLoadingSkeleton()');
    expect(ordersViewSource).toContain('Cargando comandas...');
    expect(ordersViewSource).toContain('loadingFallback={<OrdersLoadingSkeleton />}');
  });
});
