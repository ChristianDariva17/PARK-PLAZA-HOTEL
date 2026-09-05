import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modalSource = readFileSync(new URL('./CashZReportModal.jsx', import.meta.url), 'utf8');
const operationalViewsSource = readFileSync(new URL('../components/views/OperationalViews.jsx', import.meta.url), 'utf8');

describe('CashZReportModal (Corte Z Thermal Ticket Contract)', () => {
  it('contains the thermal 80mm printable layout and print media queries', () => {
    expect(modalSource).toContain('id="corte-z-printable-ticket"');
    expect(modalSource).toContain('@media print');
    expect(modalSource).toContain('width: 80mm');
    expect(modalSource).toContain('PARK PLAZA HOTEL');
    expect(modalSource).toContain('CORTE Z · CIERRE DE CAJA');
  });

  it('calculates financial summaries, differences, and handles cash breakdown in notes', () => {
    expect(modalSource).toContain('openingAmount + incomeTotal - expenseTotal');
    expect(modalSource).toContain('CUADRE EXACTO');
    expect(modalSource).toContain('SOBRANTE');
    expect(modalSource).toContain('FALTANTE');
    expect(modalSource).toContain('[Conteo Físico PEN:');
    expect(modalSource).toContain('FIRMAS DE CONFORMIDAD');
    expect(modalSource).toContain('FIRMA CAJERO');
    expect(modalSource).toContain('SUPERVISOR / ADMIN');
  });

  it('provides copy to clipboard and thermal print buttons', () => {
    expect(modalSource).toContain('handleCopy');
    expect(modalSource).toContain('handlePrint');
    expect(modalSource).toContain('navigator.clipboard');
    expect(modalSource).toContain('window.print()');
  });

  it('is properly integrated into OperationalCashView with auto-display on close and manual triggers', () => {
    expect(operationalViewsSource).toContain('import { CashZReportModal } from \'../../cash/CashZReportModal.jsx\';');
    expect(operationalViewsSource).toContain('const [reportSession, setReportSession] = useState(null);');
    expect(operationalViewsSource).toContain('onSessionClosed');
    expect(operationalViewsSource).toContain('setReportSession(closed)');
    expect(operationalViewsSource).toContain('<CashZReportModal');
    expect(operationalViewsSource).toContain('Ticket Z');
  });
});
