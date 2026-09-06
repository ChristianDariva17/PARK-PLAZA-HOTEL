import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseCheckInDto, parseIdempotencyKey, parseWalkInDto } from '../src/stays/stays.dto.js';

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const guestId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('stay command DTOs', () => {
  it('requires an opaque UUID idempotency key and strict walk-in input', () => {
    const key = randomUUID();
    expect(parseIdempotencyKey(key)).toBe(key);
    expect(parseWalkInDto({ roomId, primaryGuestId: guestId, guestIds: [guestId], checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z', guestCount: 1 })).toMatchObject({ roomId, primaryGuestId: guestId });
    expect(() => parseIdempotencyKey('retry-1')).toThrow('Invalid Idempotency-Key');
    expect(() => parseWalkInDto({ roomId, primaryGuestId: guestId, guestIds: [guestId], checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z', guestCount: 2 })).toThrow('Invalid request body');
  });
  it('only accepts a strict optional early check-in boundary', () => {
    expect(parseCheckInDto({})).toEqual({});
    expect(parseCheckInDto({ earlyCheckInAt: '2028-02-28T15:00:00.000Z' })).toEqual({ earlyCheckInAt: '2028-02-28T15:00:00.000Z' });
    expect(() => parseCheckInDto({ documentNumber: 'secret' })).toThrow('Invalid request body');
  });
});
