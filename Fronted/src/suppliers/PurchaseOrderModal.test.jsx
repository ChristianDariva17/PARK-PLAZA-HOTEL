/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPurchaseOrder: vi.fn(),
  getInventory: vi.fn(),
  getSupplierInventory: vi.fn(),
  getSuppliers: vi.fn(),
}));

vi.mock('./suppliersClient', () => ({ suppliersClient: mocks }));
vi.mock('../restaurant/restaurantClient', () => ({ getInventory: mocks.getInventory }));

import { PurchaseOrderModal } from './PurchaseOrderModal.jsx';

let appRoot;

beforeEach(() => {
  appRoot = document.createElement('div');
  appRoot.id = 'root';
  document.body.appendChild(appRoot);
  vi.clearAllMocks();
  mocks.getSuppliers.mockResolvedValue({
    items: [{ id: 'supplier-1', legalName: 'Andina Foods S.A.C.', taxId: '20100000001' }],
  });
  mocks.getInventory.mockResolvedValue([]);
  mocks.createPurchaseOrder.mockResolvedValue({
    orderNumber: 'OC-0001',
    createdAt: '2026-09-17T12:00:00.000Z',
    expectedDeliveryDate: '2026-09-19T00:00:00.000Z',
    currency: 'PEN',
    notes: 'Entrega prioritaria',
    subtotal: 159,
    tax: 28.62,
    total: 187.62,
    supplier: { legalName: 'Andina Foods S.A.C.', taxId: '20100000001' },
    items: [{ name: 'Coffee', unit: 'kg', quantity: 12, unitCost: 13.25, totalCost: 159 }],
  });
});

afterEach(() => {
  cleanup();
  appRoot?.remove();
  appRoot = null;
});

describe('PurchaseOrderModal', () => {
  it('edits prefilled inventory lines and emits a normalized purchase order', async () => {
    const onCreated = vi.fn();
    const initialItems = [
      {
        id: 'inventory-1',
        name: 'Coffee',
        unit: 'kg',
        suggestedQuantity: 10,
        cost: 12.5,
      },
    ];

    render(
      <PurchaseOrderModal
        open
        supplierId="supplier-1"
        initialItems={initialItems}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await waitFor(() => expect(screen.getByDisplayValue('10')).toBeTruthy());
    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '12' } });
    fireEvent.change(screen.getByDisplayValue('12.5'), { target: { value: '13.25' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Entregar en almacén central...'), {
      target: { value: 'Entrega prioritaria' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Emitir Orden de Compra (OC)' }));

    await waitFor(() => expect(mocks.createPurchaseOrder).toHaveBeenCalledOnce());
    expect(mocks.createPurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 'supplier-1',
        currency: 'PEN',
        notes: 'Entrega prioritaria',
        expectedDeliveryDate: expect.any(String),
        items: [
          {
            inventoryItemId: 'inventory-1',
            name: 'Coffee',
            unit: 'kg',
            quantity: 12,
            unitCost: 13.25,
          },
        ],
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: 'OC-0001' }));
    expect(screen.getByText('ORDEN DE COMPRA FORMAL')).toBeTruthy();
  });
});
