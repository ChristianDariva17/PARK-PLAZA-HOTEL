import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const attendanceSource = readFileSync(new URL('../views/staff/StaffAttendanceView.jsx', import.meta.url), 'utf8');
const htmlSource = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8');
const stylesIndexSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const moduleStylesSource = readFileSync(new URL('../styles/loadModuleStyles.js', import.meta.url), 'utf8');
const overlayStylesSource = readFileSync(new URL('../styles/loadOverlayStyles.js', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('../hooks/useAdminNavigation.js', import.meta.url), 'utf8');
const topbarSource = readFileSync(new URL('../components/layout/Topbar.jsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../dashboard/DashboardView.jsx', import.meta.url), 'utf8');
const hotelContextSource = readFileSync(new URL('../state/HotelContext.jsx', import.meta.url), 'utf8');

describe('bundle performance contracts', () => {
  it('defers optional attendance features until their surfaces are used', () => {
    expect(attendanceSource).toContain("import('./AttendanceKioskModal.jsx')");
    expect(attendanceSource).toContain("import('./StaffQrScannerModal.jsx')");
    expect(attendanceSource).toContain('{kioskOpen ? <Suspense');
    expect(attendanceSource).toContain('{scannerOpen ? <Suspense');
  });

  it('does not block first paint on the external font stylesheet', () => {
    expect(htmlSource).toContain('media="print" onload="this.media=\'all\'"');
    expect(htmlSource).toContain('<noscript><link');
  });

  it('loads the hotel provider only after authentication succeeds', () => {
    expect(appSource).toContain("lazy(() => import('./app/AuthenticatedHotelShell.jsx'))");
    expect(mainSource).not.toContain("./state/HotelContext.jsx");
  });

  it('defers module-specific styles until after the first render', () => {
    expect(stylesIndexSource).not.toContain("@import './modules.css'");
    expect(stylesIndexSource).not.toContain("@import './styles/components.css'");
    expect(stylesIndexSource).not.toContain("@import './styles/tables-forms.css'");
    expect(stylesIndexSource).not.toContain("@import './styles/overlays.css'");
    expect(stylesIndexSource).toContain("@import './styles/components-critical.css'");
    expect(moduleStylesSource).toContain("import('./components.css')");
    expect(moduleStylesSource).toContain("import('./modules.css')");
    expect(moduleStylesSource).toContain("import('./tables-forms.css')");
    expect(moduleStylesSource).toContain("import('./overlays.css')");
    expect(navigationSource).toContain("if (route !== 'dashboard') void loadModuleStyles()");
    expect(overlayStylesSource).toContain("import('./overlays.css')");
    expect(topbarSource).toContain('loadOverlayStyles');
  });

  it('keeps dashboard rendering isolated from unrelated hotel request status changes', () => {
    expect(dashboardSource).toContain('useHotelDashboardState');
    expect(hotelContextSource).toContain('HotelDashboardStateContext');
  });

  it('keeps client telemetry behind an explicit rollback flag', () => {
    expect(mainSource).toContain("import.meta.env.VITE_CLIENT_TELEMETRY !== 'false'");
  });
});
