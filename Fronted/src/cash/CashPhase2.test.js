import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const enhancedFormSource = readFileSync(new URL('./CashMovementEnhancedForm.jsx', import.meta.url), 'utf8');
const operationalViewsSource = readFileSync(new URL('../components/views/OperationalViews.jsx', import.meta.url), 'utf8');

describe('Cash Module Phase 2 - Categories, Vouchers, Blind Count, and Cash Drop', () => {
  describe('CashMovementEnhancedForm Contract', () => {
    it('defines expense and income categories for front desk operations', () => {
      expect(enhancedFormSource).toContain('EXPENSE_CATEGORIES');
      expect(enhancedFormSource).toContain('Caja Chica - Compras de Emergencia');
      expect(enhancedFormSource).toContain('Pago a Proveedores Menores');
      expect(enhancedFormSource).toContain('Devolución / Reembolso a Huésped');
      expect(enhancedFormSource).toContain('Movilidad y Transporte');
      expect(enhancedFormSource).toContain('Pase a Bóveda / Caja Fuerte (Cash Drop)');
      expect(enhancedFormSource).toContain('INCOME_CATEGORIES');
      expect(enhancedFormSource).toContain('Cobro Extraordinario en Efectivo');
    });

    it('supports voucher types and reference numbers', () => {
      expect(enhancedFormSource).toContain('VOUCHER_TYPES');
      expect(enhancedFormSource).toContain('Boleta de Venta');
      expect(enhancedFormSource).toContain('Factura');
      expect(enhancedFormSource).toContain('Recibo de Caja Chica');
      expect(enhancedFormSource).toContain('Vale de Egreso / Remesa');
      expect(enhancedFormSource).toContain('Sin Comprobante');
    });

    it('enforces high-expense control (> S/ 150) and quick presets', () => {
      expect(enhancedFormSource).toContain('numericAmount > 150');
      expect(enhancedFormSource).toContain('isHighExpense');
      expect(enhancedFormSource).toContain('Atajos Rápidos de Mostrador');
      expect(enhancedFormSource).toContain('Pase a Bóveda (Cash Drop)');
    });
  });

  describe('Arqueo Ciego (Blind Count) in CashCountForm', () => {
    it('provides blind count toggle hiding theoretical balance and variance', () => {
      expect(operationalViewsSource).toContain('const [blindMode, setBlindMode] = useState(false);');
      expect(operationalViewsSource).toContain('const [revealed, setRevealed] = useState(false);');
      expect(operationalViewsSource).toContain('Modo Arqueo Ciego Activo (Control Antifraude)');
      expect(operationalViewsSource).toContain('Revelar Cuadre');
      expect(operationalViewsSource).toContain('Activar Arqueo Ciego');
    });

    it('mandates audit notes when discrepancy is >= S/ 5.00', () => {
      expect(operationalViewsSource).toContain('const isDiscrepancy = Math.abs(difference) >= 5.00;');
      expect(operationalViewsSource).toContain('Justificación obligatoria');
      expect(operationalViewsSource).toContain('OBLIGATORIO por descuadre >= S/ 5.00');
    });
  });

  describe('Cash Drop Security Threshold & Movement Filters', () => {
    it('warns when front desk cash exceeds safety limit (S/ 2,000) and triggers cash drop', () => {
      expect(operationalViewsSource).toContain('const CASH_SAFETY_LIMIT = 2000;');
      expect(operationalViewsSource).toContain('isCashExceeded = openSession && expected > CASH_SAFETY_LIMIT;');
      expect(operationalViewsSource).toContain('Límite de seguridad en mostrador alcanzado');
      expect(operationalViewsSource).toContain('handleTriggerCashDrop');
      expect(operationalViewsSource).toContain('Pase a Bóveda (Cash Drop)');
    });

    it('provides filters for movements in the operational session table', () => {
      expect(operationalViewsSource).toContain('const [movementFilter, setMovementFilter] = useState(\'ALL\');');
      expect(operationalViewsSource).toContain('Filtrar movimientos:');
      expect(operationalViewsSource).toContain('Pases a Bóveda');
    });
  });
});
