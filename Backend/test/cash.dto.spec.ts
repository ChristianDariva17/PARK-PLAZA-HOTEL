import { describe, expect, it } from 'vitest';
import { parseCreateCashMovementDto, parseIdempotencyKey } from '../src/cash/cash.dto.js';

describe('cash command contracts', () => {
  it('accepts only physical-cash movements', () => {
    expect(parseCreateCashMovementDto({ type: 'Ingreso', concept: 'Pago en caja', amount: '12.50', method: 'Efectivo' }))
      .toEqual({ type: 'Ingreso', concept: 'Pago en caja', amount: '12.50', method: 'Efectivo' });
    expect(() => parseCreateCashMovementDto({ type: 'Ingreso', concept: 'Pago por tarjeta', amount: '12.50', method: 'Tarjeta' })).toThrow();
  });

  it('requires a UUID idempotency key for every cash command', () => {
    expect(parseIdempotencyKey('018f4f5c-0e7e-7bb1-9d55-4f8a79a51234')).toBe('018f4f5c-0e7e-7bb1-9d55-4f8a79a51234');
    expect(() => parseIdempotencyKey('duplicate-click')).toThrow();
  });
});
