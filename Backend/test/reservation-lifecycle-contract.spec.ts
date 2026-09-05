import { describe, expect, it } from 'vitest';
import { parseCancelReservationDto, parseDispositionReservationDto, parseIdempotencyKey } from '../src/reservations/reservations.dto.js';

describe('reservation lifecycle DTO contract', () => {
  it('trims nonblank reasons without imposing an arbitrary length limit', () => {
    expect(parseCancelReservationDto({ reason: `  ${'x'.repeat(600)}  ` }).reason).toHaveLength(600);
    expect(() => parseCancelReservationDto({ reason: '   ' })).toThrow();
  });
  it('accepts only UUID keys and explicit arrival dispositions', () => {
    expect(parseIdempotencyKey('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(parseDispositionReservationDto({ disposition: 'no_show', reason: 'Guest did not arrive' })).toEqual({ disposition: 'no_show', reason: 'Guest did not arrive' });
    expect(() => parseDispositionReservationDto({ disposition: 'expired', reason: ' ' })).toThrow();
    expect(() => parseDispositionReservationDto({ disposition: 'cancelled', reason: 'No' })).toThrow();
  });
});
