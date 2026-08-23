import { describe, expect, it } from 'vitest';
import { parseFolioChargeDto, parseFolioPaymentDto, parseFolioReversalDto, PAYMENT_METHODS } from '../src/folios/folio.dto.js';

describe('folio command contracts', () => {
  it('allows exactly the approved payment methods and positive two-decimal amounts', () => {
    expect(PAYMENT_METHODS).toEqual(['Efectivo', 'Tarjeta', 'Transferencia', 'Yape', 'Plin']);
    expect(parseFolioPaymentDto({ amount: '12.50', method: 'Efectivo' })).toEqual({ amount: '12.50', method: 'Efectivo' });
    expect(() => parseFolioPaymentDto({ amount: '12.5', method: 'Crypto' })).toThrow();
  });
  it('rejects non-positive, excess precision, or undocumented commands', () => {
    expect(() => parseFolioChargeDto({ amount: '0.00', description: 'x' })).toThrow();
    expect(() => parseFolioChargeDto({ amount: '1.001', description: 'x' })).toThrow();
    expect(() => parseFolioReversalDto({ reason: '' })).toThrow();
  });
});
