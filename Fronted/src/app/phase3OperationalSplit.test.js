import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registrySource = readFileSync(new URL('./adminViewComponents.jsx', import.meta.url), 'utf8');
const operationalPath = new URL('../components/views/OperationalViews.jsx', import.meta.url);
const maintenanceSource = readFileSync(new URL('../maintenance/MaintenanceView.jsx', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../inventory/InventoryView.jsx', import.meta.url), 'utf8');
const cashSource = readFileSync(new URL('../cash/CashView.jsx', import.meta.url), 'utf8');
const incidentsSource = readFileSync(new URL('../incidents/IncidentsView.jsx', import.meta.url), 'utf8');

describe('Operational feature entrypoints', () => {
  it('loads operational routes without the aggregate module', () => {
    expect(registrySource).toContain("import('../maintenance/MaintenanceView')");
    expect(registrySource).toContain("import('../inventory/InventoryView')");
    expect(registrySource).toContain("import('../cash/CashView')");
    expect(registrySource).toContain("import('../incidents/IncidentsView')");
    expect(registrySource).not.toContain("import('../components/views/OperationalViews')");
  });

  it('keeps each operational view in its feature entrypoint', () => {
    expect(existsSync(operationalPath)).toBe(false);
    expect(maintenanceSource).toContain('export function OperationalMaintenanceView');
    expect(inventorySource).toContain('export function OperationalInventoryView');
    expect(cashSource).toContain('export function OperationalCashView');
    expect(incidentsSource).toContain('export function OperationalIncidentsView');
  });
});
