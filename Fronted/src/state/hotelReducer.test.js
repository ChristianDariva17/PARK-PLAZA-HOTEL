import { describe, expect, it } from 'vitest';
import { getInitialHotelState } from '../domain/hotelModel.js';
import { hotelReducer } from './hotelReducer.js';

const initial = { clients: [], guestRequest: { status: 'idle', error: null } };
const first = { id: 'guest-1', name: 'Ana Torres' };
const updated = { id: 'guest-1', name: 'Ana Pérez' };

describe('hotelReducer guest events', () => {
  it('tracks load lifecycle without treating a failure as an empty success', () => {
    const loading = hotelReducer(initial, { type: 'GUESTS_LOAD_STARTED' });
    const failed = hotelReducer({ ...loading, clients: [first] }, { type: 'GUESTS_LOAD_FAILED', error: 'Sin conexión' });
    expect(loading.guestRequest).toEqual({ status: 'loading', error: null });
    expect(failed.clients).toEqual([first]);
    expect(failed.guestRequest).toEqual({ status: 'error', error: 'Sin conexión' });
  });

  it('replaces clients on successful authoritative load', () => {
    const state = hotelReducer(initial, { type: 'GUESTS_LOAD_SUCCEEDED', clients: [first] });
    expect(state.clients).toEqual([first]);
    expect(state.guestRequest).toEqual({ status: 'success', error: null });
  });

  it('leaves a superseded load in a terminal state without discarding clients', () => {
    const withClients = hotelReducer({ clients: [first], guestRequest: { status: 'loading', error: null } }, { type: 'GUESTS_LOAD_CANCELLED' });
    const withoutClients = hotelReducer({ clients: [], guestRequest: { status: 'loading', error: null } }, { type: 'GUESTS_LOAD_CANCELLED' });
    expect(withClients).toEqual({ clients: [first], guestRequest: { status: 'success', error: null } });
    expect(withoutClients).toEqual({ clients: [], guestRequest: { status: 'idle', error: null } });
  });

  it('commits create and update responses immutably', () => {
    const created = hotelReducer(initial, { type: 'GUEST_CREATED_COMMITTED', client: first });
    const result = hotelReducer(created, { type: 'GUEST_UPDATED_COMMITTED', client: updated });
    expect(created.clients).toEqual([first]);
    expect(result.clients).toEqual([updated]);
    expect(result.clients).not.toBe(created.clients);
  });

  it('resets guest data on identity changes or logout', () => {
    const state = hotelReducer({ clients: [first], guestRequest: { status: 'error', error: 'Error' } }, { type: 'GUESTS_RESET' });
    expect(state).toEqual({ clients: [], guestRequest: { status: 'idle', error: null } });
  });
});

describe('hotelReducer room events', () => {
  const room = { id: '550e8400-e29b-41d4-a716-446655440000', number: '101', status: 'Disponible' };
  const category = { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Simple' };
  const roomInitial = { rooms: [], roomCategories: [], roomRequest: { status: 'idle', error: null } };

  it('replaces inventory authoritatively and tracks load and mutation lifecycle', () => {
    const loading = hotelReducer(roomInitial, { type: 'ROOMS_LOAD_STARTED' });
    const loaded = hotelReducer(loading, { type: 'ROOMS_LOAD_SUCCEEDED', rooms: [room], categories: [category] });
    const saving = hotelReducer(loaded, { type: 'ROOM_MUTATION_STARTED' });
    const committed = hotelReducer(saving, { type: 'ROOM_MUTATION_COMMITTED', room: { ...room, number: '102' } });
    expect(loading.roomRequest.status).toBe('loading');
    expect(loaded).toEqual({ rooms: [room], roomCategories: [category], roomRequest: { status: 'success', error: null } });
    expect(saving.roomRequest.status).toBe('saving');
    expect(committed.rooms[0].number).toBe('102');
  });

  it('keeps cancel terminal, reports failure, and resets identity-scoped inventory', () => {
    const loaded = { rooms: [room], roomCategories: [category], roomRequest: { status: 'loading', error: null } };
    expect(hotelReducer(loaded, { type: 'ROOM_REQUEST_CANCELLED' }).roomRequest).toEqual({ status: 'success', error: null });
    expect(hotelReducer(loaded, { type: 'ROOM_REQUEST_FAILED', error: 'Sin conexión' }).roomRequest).toEqual({ status: 'error', error: 'Sin conexión' });
    expect(hotelReducer(loaded, { type: 'ROOMS_RESET' })).toEqual(roomInitial);
  });

  it('does not let legacy room update and block events mutate authoritative rooms', () => {
    const state = { ...roomInitial, rooms: [room] };
    expect(hotelReducer(state, { type: 'ROOM_UPDATE', roomId: room.id, payload: { number: '999' } })).toBe(state);
    expect(hotelReducer(state, { type: 'ROOM_BLOCK', roomId: room.id, reason: 'Local' })).toBe(state);
    expect(hotelReducer(state, { type: 'ROOM_UNBLOCK', roomId: room.id, reason: 'Local' })).toBe(state);
  });
});

describe('hotelReducer persistent operational boundary', () => {
  it.each(['PARKING_CREATE', 'PARKING_UPDATE', 'PARKING_EXIT', 'PARKING_ARCHIVE', 'PET_CREATE', 'PET_UPDATE', 'PET_ARCHIVE', 'PET_REACTIVATE'])('quarantines legacy optimistic action %s', (type) => {
    const state = { vehicles: [{ id: 'VEH-001', status: 'Dentro' }], pets: [{ id: 'PET-001', status: 'Activa' }] };
    expect(hotelReducer(state, { type, payload: {}, vehicleId: 'VEH-001', petId: 'PET-001', reason: 'test' })).toBe(state);
  });
});

describe('hotelReducer persistent reservation events', () => {
  const legacyReservation = { id: 'RES-001', status: 'Confirmada' };
  const persistentReservation = { id: '6ba7b811-9dad-41d1-80b4-00c04fd430c8', status: 'pending' };
  const availability = { checkIn: '2028-02-28', checkOut: '2028-03-01', nightCount: 2, guestCount: 2, rooms: [] };
  const reservationInitial = {
    reservations: [legacyReservation],
    persistentReservations: [],
    reservationRequest: { status: 'idle', error: null },
    reservationAvailability: null,
    reservationAvailabilityRequest: { status: 'idle', error: null },
    reservationCreateRequest: { status: 'idle', error: null, retryBlocked: false },
  };

  it('initializes a dedicated persistent collection without replacing demo reservations', () => {
    const state = getInitialHotelState();
    expect(state.persistentReservations).toEqual([]);
    expect(state.reservations.length).toBeGreaterThan(0);
    expect(state.persistentReservations).not.toBe(state.reservations);
  });

  it('tracks authoritative list lifecycle without touching legacy reservations', () => {
    const loading = hotelReducer(reservationInitial, { type: 'RESERVATIONS_LOAD_STARTED' });
    const loaded = hotelReducer(loading, { type: 'RESERVATIONS_LOAD_SUCCEEDED', reservations: [persistentReservation] });
    const failed = hotelReducer(loaded, { type: 'RESERVATIONS_LOAD_FAILED', error: 'Sin conexión' });
    expect(loading.reservationRequest.status).toBe('loading');
    expect(loaded.persistentReservations).toEqual([persistentReservation]);
    expect(failed.reservationRequest).toEqual({ status: 'error', error: 'Sin conexión' });
    expect(failed.reservations).toEqual([legacyReservation]);
  });

  it('tracks availability and clears stale results before a new request', () => {
    const loaded = hotelReducer(reservationInitial, { type: 'RESERVATION_AVAILABILITY_SUCCEEDED', availability });
    const loading = hotelReducer(loaded, { type: 'RESERVATION_AVAILABILITY_STARTED' });
    expect(loaded.reservationAvailability).toBe(availability);
    expect(loading.reservationAvailability).toBeNull();
    expect(loading.reservationAvailabilityRequest).toEqual({ status: 'loading', error: null });
  });

  it('commits creates only to persistentReservations and models blocked reconciliation', () => {
    const saving = hotelReducer(reservationInitial, { type: 'RESERVATION_CREATE_STARTED' });
    const committed = hotelReducer(saving, { type: 'RESERVATION_CREATE_COMMITTED', reservation: persistentReservation });
    const blocked = hotelReducer(committed, { type: 'RESERVATION_CREATE_FAILED', error: 'Actualización requerida', retryBlocked: true });
    expect(saving.reservationCreateRequest.status).toBe('saving');
    expect(committed.persistentReservations).toEqual([persistentReservation]);
    expect(committed.reservations).toEqual([legacyReservation]);
    expect(blocked.reservationCreateRequest).toEqual({ status: 'error', error: 'Actualización requerida', retryBlocked: true });
  });

  it('resets every identity-scoped reservation resource but preserves legacy demo records', () => {
    const populated = {
      ...reservationInitial,
      persistentReservations: [persistentReservation],
      reservationAvailability: availability,
      reservationRequest: { status: 'error', error: 'Error' },
      reservationAvailabilityRequest: { status: 'success', error: null },
      reservationCreateRequest: { status: 'error', error: 'Error', retryBlocked: true },
    };
    const reset = hotelReducer(populated, { type: 'RESERVATIONS_RESET' });
    expect(reset).toEqual(reservationInitial);
  });

  it('never makes a persistent reservation eligible for the current local check-in path', () => {
    const state = { ...reservationInitial, persistentReservations: [persistentReservation] };
    expect(hotelReducer(state, { type: 'CHECK_IN', reservationId: persistentReservation.id })).toBe(state);
  });
});
