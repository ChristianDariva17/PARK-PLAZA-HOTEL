import { describe, expect, it } from 'vitest';
import { parseBlockRoomDto, parseRoomId, parseUpdateRoomDto } from '../src/rooms/rooms.dto.js';

describe('room DTOs', () => {
  it('normalizes a strict non-empty room patch', () => {
    const categoryId = '550e8400-e29b-41d4-a716-446655440000';
    expect(parseUpdateRoomDto({ number: ' 204 ', floor: 2, categoryId })).toEqual({ number: '204', floor: 2, categoryId });
  });

  it('rejects empty, forbidden, unknown, and invalid patch fields', () => {
    expect(() => parseUpdateRoomDto({})).toThrow('Invalid request body');
    expect(() => parseUpdateRoomDto({ status: 'blocked' })).toThrow('Invalid request body');
    expect(() => parseUpdateRoomDto({ propertyId: '550e8400-e29b-41d4-a716-446655440000' })).toThrow('Invalid request body');
    expect(() => parseUpdateRoomDto({ number: ' ', floor: 1.5 })).toThrow('Invalid request body');
  });

  it('requires an exact block payload and validates route UUIDs', () => {
    expect(parseBlockRoomDto({ blocked: true, reason: '  Preventive inspection ' })).toEqual({ blocked: true, reason: 'Preventive inspection' });
    expect(() => parseBlockRoomDto({ blocked: true, reason: ' ', status: 'blocked' })).toThrow('Invalid request body');
    expect(() => parseRoomId('not-a-uuid')).toThrow('Invalid room ID');
  });
});
