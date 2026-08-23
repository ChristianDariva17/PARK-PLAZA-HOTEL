import { describe, expect, it } from 'vitest';
import { PAYMENT_METHODS, canOverrideCheckout, canReverseEntry, checkoutDebtMessage, validateFolioAmount } from './folioModel.js';

describe('folio UI policy', () => {
  it('exposes only approved payment methods and two-decimal positive amounts', () => {
    expect(PAYMENT_METHODS).toEqual(['Efectivo', 'Tarjeta', 'Transferencia', 'Yape', 'Plin']);
    expect(validateFolioAmount('3.50')).toBe('3.50');
    expect(() => validateFolioAmount('3.5')).toThrow();
  });
  it('requires both checkout permissions for a receivable override', () => {
    expect(canOverrideCheckout(['stays.check_out'], { balance: '5.00' })).toBe(false);
    expect(canOverrideCheckout(['stays.check_out', 'stays.check_out_override'], { balance: '5.00' })).toBe(true);
  });
  it('keeps debt visible and hides a command already corrected by a reversal', () => {
    const charge = { id: 'charge-id', type: 'charge' };
    expect(checkoutDebtMessage({ balance: '5.00' })).toContain('Saldo pendiente');
    expect(canReverseEntry(charge, [{ id: 'reversal-id', type: 'reversal', reversalOfEntryId: 'charge-id' }])).toBe(false);
  });
});
