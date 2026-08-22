import { describe, expect, it } from 'vitest';
import { assertInterval, resolveLocalMinute } from '../src/reservations/interval-policy.js';
import { parseAvailabilityQuery, parseCreateReservationDto } from '../src/reservations/reservations.dto.js';

const input = { roomId: '550e8400-e29b-41d4-a716-446655440000', primaryGuestId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8', checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-02-29T11:00:00.000Z', guestCount: 2 };
const policy = { timezone: 'America/Lima', dayUseStart: '09:00', dayUseEnd: '18:00', dayUseMinimumMinutes: 180, reservationIntervalMinutes: 30 };

describe('reservation interval DTOs and policy', () => {
  it('accepts strict UUID-based UTC interval input and rejects caller authority fields', () => {
    expect(parseCreateReservationDto(input)).toEqual(input);
    expect(() => parseCreateReservationDto({ ...input, propertyId: input.roomId })).toThrow('Invalid request body');
  });

  it('accepts overnight and configured day-use intervals on 30-minute boundaries', () => {
    expect(assertInterval(policy, { checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-02-29T11:00:00.000Z' }).minutes).toBe(1200);
    expect(assertInterval(policy, { checkInAt: '2028-02-28T14:00:00.000Z', checkOutAt: '2028-02-28T17:00:00.000Z' }).minutes).toBe(180);
  });

  it('rejects invalid local policy intervals and DST gaps or folds without a silent conversion', () => {
    expect(() => assertInterval(policy, { checkInAt: '2028-02-28T14:15:00.000Z', checkOutAt: '2028-02-28T17:15:00.000Z' })).toThrow();
    expect(() => assertInterval(policy, { checkInAt: '2028-02-28T13:00:00.000Z', checkOutAt: '2028-02-28T14:00:00.000Z' })).toThrow();
    expect(() => resolveLocalMinute('2028-03-12T02:30', 'America/New_York')).toThrow();
    expect(() => resolveLocalMinute('2028-11-05T01:30', 'America/New_York')).toThrow();
  });

  it('strictly parses UTC availability queries', () => {
    expect(parseAvailabilityQuery({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: '2' })).toEqual({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: 2 });
    expect(() => parseAvailabilityQuery({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: 2 })).toThrow('Invalid availability query');
  });
});
