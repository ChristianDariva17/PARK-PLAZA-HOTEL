import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const authenticatedShellSource = readFileSync(new URL('./AuthenticatedHotelShell.jsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('../hooks/useAdminNavigation.js', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../components/routing/AdminRouteContent.jsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../components/layout/HotelShell.jsx', import.meta.url), 'utf8');
const viewRegistrySource = readFileSync(new URL('./adminViewComponents.jsx', import.meta.url), 'utf8');

describe('admin shell composition', () => {
  it('keeps authentication entry in App and moves the authenticated shell out', () => {
    expect(appSource).toContain("const AuthenticatedHotelShell = lazy(() => import('./app/AuthenticatedHotelShell.jsx'));");
    expect(appSource).not.toContain("import HotelShell from './components/layout/HotelShell.jsx';");
    expect(authenticatedShellSource).toContain("import HotelShell from '../components/layout/HotelShell.jsx';");
    expect(authenticatedShellSource).toContain('<HotelProvider><HotelShell /></HotelProvider>');
    expect(shellSource).toContain('export default function HotelShell()');
  });

  it('keeps hash navigation and route authorization in the navigation hook', () => {
    expect(navigationSource).toContain("import { useHashRoute } from './useHashRoute.js';");
    expect(navigationSource).toContain('permissionForRoute');
    expect(shellSource).toContain('useAdminNavigation(can)');
  });

  it('keeps lazy view resolution and route states in the route layer', () => {
    expect(viewRegistrySource).toContain('export const VIEW_COMPONENTS');
    expect(routeSource).toContain('RouteErrorBoundary');
    expect(routeSource).toContain('ContractBlockedView');
    expect(routeSource).toContain('<Suspense');
    expect(shellSource).toContain('<AdminRouteContent');
  });
});
