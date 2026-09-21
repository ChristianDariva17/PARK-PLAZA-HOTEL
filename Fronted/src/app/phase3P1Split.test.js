import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registrySource = readFileSync(new URL('./adminViewComponents.jsx', import.meta.url), 'utf8');
const p1Path = new URL('../components/views/P1Views.jsx', import.meta.url);
const parkingSource = readFileSync(new URL('../parking/ParkingView.jsx', import.meta.url), 'utf8');
const petsSource = readFileSync(new URL('../pets/PetsView.jsx', import.meta.url), 'utf8');
const notificationsSource = readFileSync(new URL('../communications/AdminNotificationsView.jsx', import.meta.url), 'utf8');
const cleaningSource = readFileSync(new URL('../cleaning/CleaningView.jsx', import.meta.url), 'utf8');
const recreationSource = readFileSync(new URL('../amenities/RecreationView.jsx', import.meta.url), 'utf8');

describe('P1 feature entrypoints', () => {
  it('loads extracted P1 features without the P1 aggregate', () => {
    expect(registrySource).toContain("import('../parking/ParkingView')");
    expect(registrySource).toContain("import('../pets/PetsView')");
    expect(registrySource).toContain("import('../communications/AdminNotificationsView')");
    expect(registrySource).toContain("import('../cleaning/CleaningView')");
    expect(registrySource).toContain("import('../amenities/RecreationView')");
    expect(registrySource).not.toContain("notificaciones: p1('P1NotificationsView')");
    expect(registrySource).not.toContain("cochera: p1('P1ParkingView')");
    expect(registrySource).not.toContain("mascotas: p1('P1PetsView')");
    expect(registrySource).not.toContain("limpieza: p1('P1CleaningView')");
    expect(registrySource).not.toContain("recreacion: p1('P1RecreationView')");
  });

  it('retires the obsolete P1 aggregate after all routes have feature entrypoints', () => {
    expect(existsSync(p1Path)).toBe(false);
    expect(parkingSource).toContain('export function P1ParkingView');
    expect(petsSource).toContain('export function P1PetsView');
    expect(notificationsSource).toContain('export function AdminNotificationsView');
    expect(cleaningSource).toContain('export function P1CleaningView');
    expect(recreationSource).toContain('export function P1RecreationView');
  });
});
