import { describe, expect, it } from 'vitest';
import {
  adaptRoomCategoryMutationResponse,
  adaptRoomCategoryResponse,
  adaptRoomInventoryResponse,
  adaptRoomMutationResponse,
  adaptRoomResponse,
  buildCategoryPatch,
  displayRoomReference,
  RoomContractError,
  roomStatusToCode,
  roomStatusToLabel,
  selectRoomById,
} from './roomModel.js';

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const otherRoomId = '550e8400-e29b-41d4-a716-446655440002';
const categoryId = '550e8400-e29b-41d4-a716-446655440001';
const categoryResponse = {
  id: categoryId,
  code: 'SIMPLE',
  name: 'Simple',
  capacity: 1,
  baseNightlyRate: '95.00',
  createdAt: '2026-08-14T12:00:00.000Z',
};
const roomResponse = {
  id: roomId,
  number: '101',
  floor: 1,
  status: 'available',
  createdAt: '2026-08-14T12:00:00.000Z',
  category: categoryResponse,
};

const expectContractFailure = (operation) => expect(operation).toThrow(RoomContractError);

describe('room response adapter', () => {
  it('maps every backend status in both directions and fails closed on unknown values', () => {
    const statuses = ['available', 'reserved', 'occupied', 'cleaning', 'maintenance', 'blocked', 'out_of_service'];
    statuses.forEach((status) => expect(roomStatusToCode(roomStatusToLabel(status))).toBe(status));
    expectContractFailure(() => roomStatusToLabel('future_status'));
    expect(() => roomStatusToCode('Estado futuro')).toThrow('no es válido');
  });

  it('accepts valid boundary values and retains the exact decimal string', () => {
    const boundaryCategory = {
      ...categoryResponse,
      code: 'C'.repeat(32),
      name: 'N'.repeat(100),
      capacity: 1,
      baseNightlyRate: '999999999999.99',
    };
    const room = adaptRoomResponse({ ...roomResponse, number: 'R'.repeat(16), floor: -10, category: boundaryCategory });
    expect(room).toMatchObject({ id: roomId, number: 'R'.repeat(16), floor: -10, categoryId, nightlyRate: '999999999999.99', status: 'Disponible' });
    expect(typeof room.nightlyRate).toBe('string');
    expect(adaptRoomCategoryResponse({ ...categoryResponse, baseNightlyRate: '0.00' }).baseNightlyRate).toBe('0.00');
  });

  it.each([
    ['id', { id: 'category-id' }],
    ['code', { code: '' }],
    ['code length', { code: 'C'.repeat(33) }],
    ['name', { name: '   ' }],
    ['name length', { name: 'N'.repeat(101) }],
    ['capacity type', { capacity: 1.5 }],
    ['capacity range', { capacity: 0 }],
    ['negative rate', { baseNightlyRate: '-1.00' }],
    ['rate precision', { baseNightlyRate: '1000000000000.00' }],
    ['rate scale', { baseNightlyRate: '1.001' }],
    ['rate type', { baseNightlyRate: 95 }],
    ['timestamp', { createdAt: '2026-02-30T12:00:00.000Z' }],
  ])('rejects malformed category %s', (_label, change) => {
    expectContractFailure(() => adaptRoomCategoryResponse({ ...categoryResponse, ...change }));
  });

  it.each([
    ['id', { id: 'room-id' }],
    ['number', { number: '' }],
    ['number length', { number: '1'.repeat(17) }],
    ['floor type', { floor: '1' }],
    ['floor finite', { floor: Number.POSITIVE_INFINITY }],
    ['floor integer', { floor: 1.5 }],
    ['status', { status: 'future_status' }],
    ['timestamp', { createdAt: 'not-a-timestamp' }],
  ])('rejects malformed room %s', (_label, change) => {
    expectContractFailure(() => adaptRoomResponse({ ...roomResponse, ...change }));
  });

  it('rejects unexpected scope and response fields at every boundary', () => {
    expectContractFailure(() => adaptRoomCategoryResponse({ ...categoryResponse, propertyId: 'hidden-scope' }));
    expectContractFailure(() => adaptRoomResponse({ ...roomResponse, propertyId: 'hidden-scope' }));
    expectContractFailure(() => adaptRoomInventoryResponse({ rooms: [roomResponse], categories: [categoryResponse], propertyId: 'hidden-scope' }));
  });

  it('normalizes contract failures without exposing malformed values', () => {
    let error;
    try {
      adaptRoomResponse({ ...roomResponse, number: 'private-malformed-value-that-is-too-long' });
    } catch (failure) {
      error = failure;
    }
    expect(error).toMatchObject({ name: 'RoomContractError', code: 'invalid_response', status: null, reloadRecommended: true });
    expect(error.message).not.toContain('private-malformed-value');
  });

  it('requires GET rooms to reference an identical category from the returned catalog', () => {
    expect(adaptRoomInventoryResponse({ rooms: [roomResponse], categories: [categoryResponse] })).toMatchObject({ rooms: [{ id: roomId }], categories: [{ id: categoryId }] });
    expectContractFailure(() => adaptRoomInventoryResponse({ rooms: [roomResponse], categories: [] }));
    expectContractFailure(() => adaptRoomInventoryResponse({ rooms: [roomResponse], categories: [{ ...categoryResponse, name: 'Different' }] }));
    expectContractFailure(() => adaptRoomInventoryResponse({ rooms: [roomResponse], categories: [categoryResponse, categoryResponse] }));
    expectContractFailure(() => adaptRoomInventoryResponse({ rooms: {}, categories: [] }));
  });

  it('correlates mutation responses to the exact requested UUID', () => {
    expect(adaptRoomMutationResponse(roomResponse, roomId)).toMatchObject({ id: roomId, number: '101' });
    expectContractFailure(() => adaptRoomMutationResponse({ ...roomResponse, id: otherRoomId }, roomId));
    expectContractFailure(() => adaptRoomMutationResponse(roomResponse, '101'));
  });

  it('correlates category mutation responses to the exact requested UUID', () => {
    expect(adaptRoomCategoryMutationResponse(categoryResponse, categoryId)).toMatchObject({ id: categoryId, name: 'Simple', baseNightlyRate: '95.00' });
    expectContractFailure(() => adaptRoomCategoryMutationResponse(categoryResponse, otherRoomId));
  });

  it('builds category patch only for changed fields', () => {
    const current = { name: 'Simple', code: 'SIMPLE', capacity: 1, baseNightlyRate: '95.00' };
    expect(buildCategoryPatch(current, { name: 'Simple Eco', baseNightlyRate: 110 })).toEqual({ name: 'Simple Eco', baseNightlyRate: '110.00' });
    expect(buildCategoryPatch(current, { name: 'Simple', code: 'SIMPLE', capacity: 1, baseNightlyRate: '95.00' })).toBeNull();
  });

  it('resolves rooms only by exact UUID and never by room number', () => {
    const state = { rooms: [adaptRoomResponse(roomResponse)] };
    expect(selectRoomById(state, roomId)?.number).toBe('101');
    expect(selectRoomById(state, '101')).toBeUndefined();
    expect(displayRoomReference(state, '101')).toBe('Habitación no disponible');
  });
});
