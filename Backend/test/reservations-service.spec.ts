import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertEligibleEarlyCheckIn, assertInterval, proratedAmount } from '../src/reservations/interval-policy.js';

const policy = { timezone: 'America/Lima', dayUseStart: '09:00', dayUseEnd: '18:00', dayUseMinimumMinutes: 180, reservationIntervalMinutes: 30 };

describe('reservation interval policy', () => {
  it('uses half-open adjacent intervals and exact decimal money', () => {
    const first = assertInterval(policy, { checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z' });
    const second = assertInterval(policy, { checkInAt: first.checkOutAt.toISOString(), checkOutAt: '2028-03-02T11:00:00.000Z' });
    expect(first.checkOutAt).toEqual(second.checkInAt);
    expect(proratedAmount('123.45', 1200)).toBe('102.88');
  });

  it('allows an eligible early check-in and rejects one more than one local day early', () => {
    expect(() => assertEligibleEarlyCheckIn(policy, new Date('2028-03-02T15:00:00.000Z'), new Date('2028-03-01T15:00:00.000Z'))).not.toThrow();
    expect(() => assertEligibleEarlyCheckIn(policy, new Date('2028-03-02T15:00:00.000Z'), new Date('2028-02-28T15:00:00.000Z'))).toThrow(BadRequestException);
  });
});
