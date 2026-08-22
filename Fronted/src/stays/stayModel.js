const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;
const DECIMAL_PATTERN = /^0\.00$/;
const RESPONSE_KEYS = ['folio', 'reservation', 'room', 'stay'];
const STAY_KEYS = ['checkInAt', 'checkOutAt', 'id', 'reservationId', 'roomId', 'status'];
const FOLIO_KEYS = ['id', 'openingBalance', 'stayId'];
const RESERVATION_KEYS = ['checkInAt', 'checkOutAt', 'id', 'status'];
const ROOM_KEYS = ['id', 'status'];

export class StayContractError extends Error {
  constructor() { super('El servidor devolvió datos de estadía no válidos. Se recargarán los datos antes de permitir otro intento.'); this.name = 'StayContractError'; this.code = 'invalid_response'; this.reloadRecommended = true; this.ambiguous = true; }
}
const fail = () => { throw new StayContractError(); };
const exact = (value, keys) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).toSorted().every((key, index) => key === keys[index]) && Object.keys(value).length === keys.length);
const uuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);
const timestamp = (value) => typeof value === 'string' && UTC_TIMESTAMP_PATTERN.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;

export function adaptStayCommandResponse(response) {
  if (!exact(response, RESPONSE_KEYS) || !exact(response.stay, STAY_KEYS) || !exact(response.folio, FOLIO_KEYS) || !exact(response.reservation, RESERVATION_KEYS) || !exact(response.room, ROOM_KEYS)
    || !uuid(response.stay.id) || !uuid(response.stay.reservationId) || !uuid(response.stay.roomId) || !['active', 'checked_out'].includes(response.stay.status) || !timestamp(response.stay.checkInAt) || (response.stay.checkOutAt !== null && !timestamp(response.stay.checkOutAt))
    || !uuid(response.folio.id) || response.folio.stayId !== response.stay.id || !DECIMAL_PATTERN.test(response.folio.openingBalance)
    || response.reservation.id !== response.stay.reservationId || !['checked_in', 'completed'].includes(response.reservation.status) || !timestamp(response.reservation.checkInAt) || !timestamp(response.reservation.checkOutAt)
    || response.room.id !== response.stay.roomId || !['available', 'occupied', 'cleaning'].includes(response.room.status)) fail();
  if ((response.stay.status === 'active' && response.stay.checkOutAt !== null) || (response.stay.status === 'checked_out' && response.stay.checkOutAt === null)) fail();
  return { ...response, stay: { ...response.stay }, folio: { ...response.folio }, reservation: { ...response.reservation }, room: { ...response.room } };
}

export function adaptPersistentStayList(response) {
  if (!Array.isArray(response)) fail();
  const records = response.map((stay) => {
    if (!exact(stay, STAY_KEYS) || !uuid(stay.id) || !uuid(stay.reservationId) || !uuid(stay.roomId) || !['active', 'checked_out'].includes(stay.status) || !timestamp(stay.checkInAt) || (stay.checkOutAt !== null && !timestamp(stay.checkOutAt))) fail();
    if ((stay.status === 'active' && stay.checkOutAt !== null) || (stay.status === 'checked_out' && stay.checkOutAt === null)) fail();
    return { ...stay };
  });
  if (new Set(records.map((stay) => stay.id)).size !== records.length) fail();
  return records;
}

export const createStayIdempotencyKey = () => {
  if (typeof crypto?.randomUUID !== 'function') throw new Error('El navegador no puede generar una clave de idempotencia segura.');
  return crypto.randomUUID();
};
