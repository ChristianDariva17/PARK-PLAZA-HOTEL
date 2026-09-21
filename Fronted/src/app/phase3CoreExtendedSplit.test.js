import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registrySource = readFileSync(new URL('./adminViewComponents.jsx', import.meta.url), 'utf8');
const corePath = new URL('../components/views/CoreViews.jsx', import.meta.url);
const extendedPath = new URL('../components/views/ExtendedViews.jsx', import.meta.url);
const dashboardSource = readFileSync(new URL('../dashboard/DashboardView.jsx', import.meta.url), 'utf8');
const reportsSource = readFileSync(new URL('../reports/ReportsView.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../settings/SettingsView.jsx', import.meta.url), 'utf8');
const rolesSource = readFileSync(new URL('../components/views/roles/RolesManagementView.jsx', import.meta.url), 'utf8');

describe('Core and Extended feature entrypoints', () => {
  it('loads Dashboard, Reports, Roles, and Settings without aggregate modules', () => {
    expect(registrySource).toContain("import('../dashboard/DashboardView')");
    expect(registrySource).toContain("import('../reports/ReportsView')");
    expect(registrySource).toContain("import('../components/views/roles/RolesManagementView')");
    expect(registrySource).toContain("import('../settings/SettingsView')");
    expect(registrySource).not.toContain("import('../components/views/CoreViews')");
    expect(registrySource).not.toContain("import('../components/views/ExtendedViews')");
  });

  it('retires both aggregate view modules', () => {
    expect(existsSync(corePath)).toBe(false);
    expect(existsSync(extendedPath)).toBe(false);
    expect(dashboardSource).toContain('export function DashboardView');
    expect(reportsSource).toContain('export function ReportsView');
    expect(settingsSource).toContain('export function SettingsView');
    expect(rolesSource).toContain('export function RolesManagementView');
  });
});
