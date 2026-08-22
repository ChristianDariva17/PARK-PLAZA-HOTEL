import { describe, expect, it } from 'vitest';
import { assertCompatibleCategory, assertCompatibleRoom, PARK_PLAZA_ROOM_CATEGORIES, PARK_PLAZA_ROOMS } from '../src/database/provision-room-inventory.js';

describe('room inventory provisioning definitions', () => {
  it('defines 38 unique rooms across the current four floors', () => {
    expect(PARK_PLAZA_ROOMS).toHaveLength(38);
    expect(new Set(PARK_PLAZA_ROOMS.map((room) => room.number)).size).toBe(38);
    expect([...new Set(PARK_PLAZA_ROOMS.map((room) => room.floor))]).toEqual([1, 2, 3, 4]);
    expect(PARK_PLAZA_ROOMS.every((room) => PARK_PLAZA_ROOM_CATEGORIES.some((category) => category.code === room.categoryCode))).toBe(true);
  });

  it('accepts exact compatible reruns without depending on room status', () => {
    const category = PARK_PLAZA_ROOM_CATEGORIES[0]!;
    expect(() => assertCompatibleCategory({ name: category.name, capacity: category.capacity, baseNightlyRate: '95.0' }, category)).not.toThrow();
    expect(() => assertCompatibleRoom({ floor: 1, categoryId: 'category-id' }, { number: '101', floor: 1, categoryCode: category.code }, 'category-id')).not.toThrow();
  });

  it('rejects category and room definition conflicts', () => {
    const category = PARK_PLAZA_ROOM_CATEGORIES[0]!;
    expect(() => assertCompatibleCategory({ name: 'Changed', capacity: category.capacity, baseNightlyRate: category.baseNightlyRate }, category)).toThrow('conflicts');
    expect(() => assertCompatibleRoom({ floor: 2, categoryId: 'category-id' }, { number: '101', floor: 1, categoryCode: category.code }, 'category-id')).toThrow('conflicts');
  });
});
