const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_14_2_PATTERN = /^(?:0|[1-9]\d{0,11})\.\d{2}$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;
const RESERVATION_KEYS = ['checkInAt', 'checkOutAt', 'createdAt', 'guestCount', 'id', 'nightlyRate', 'primaryGuestId', 'roomId', 'status', 'totalAmount', 'updatedAt'];
const AVAILABILITY_KEYS = ['checkInAt', 'checkOutAt', 'durationMinutes', 'guestCount', 'policy', 'rooms'];
const POLICY_KEYS = ['dayUseEnd', 'dayUseMinimumMinutes', 'dayUseStart', 'reservationIntervalMinutes', 'timezone'];
const AVAILABLE_ROOM_KEYS = ['capacity', 'categoryId', 'floor', 'nightlyRate', 'number', 'operationalStatus', 'roomId', 'totalAmount'];
const CREATE_KEYS = ['checkInAt', 'checkOutAt', 'guestCount', 'primaryGuestId', 'roomId'];
const QUERY_KEYS = ['checkInAt', 'checkOutAt', 'guestCount'];
const INVALID_RESPONSE_MESSAGE = 'El servidor devolvió datos de reservas no válidos. Actualice la información e intente nuevamente.';

export const RESERVATION_STATUS_LABELS = Object.freeze({ pending: 'Pendiente', confirmed: 'Confirmada', checked_in: 'Cliente presente', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No presentado', expired: 'Vencida' });
export const RESERVATION_OPERATIONAL_STATUS_LABELS = Object.freeze({ available: 'Disponible', reserved: 'Reservada', occupied: 'Ocupada', cleaning: 'En limpieza', maintenance: 'En mantenimiento', blocked: 'Bloqueada', out_of_service: 'Fuera de servicio' });

export class ReservationContractError extends Error {
  constructor() { super(INVALID_RESPONSE_MESSAGE); this.name = 'ReservationContractError'; this.code = 'invalid_response'; this.status = null; this.reloadRecommended = true; this.ambiguous = true; }
}
const failContract = () => { throw new ReservationContractError(); };
const hasExactKeys = (value, keys) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).toSorted().every((key, index) => key === keys[index]) && Object.keys(value).length === keys.length);
const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);
const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isDecimal = (value) => typeof value === 'string' && DECIMAL_14_2_PATTERN.test(value);
const isUtcTimestamp = (value) => typeof value === 'string' && UTC_TIMESTAMP_PATTERN.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
const validInterval = (checkInAt, checkOutAt) => isUtcTimestamp(checkInAt) && isUtcTimestamp(checkOutAt) && checkOutAt > checkInAt;

export const reservationStatusToLabel = (status) => RESERVATION_STATUS_LABELS[status] || failContract();
export const reservationOperationalStatusToLabel = (status) => RESERVATION_OPERATIONAL_STATUS_LABELS[status] || failContract();
export const formatReservationMoney = (value) => isDecimal(value) ? `S/ ${value}` : failContract();
export const formatReservationInstant = (value) => isUtcTimestamp(value) ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) : failContract();

export function adaptReservationResponse(response) {
  if (!hasExactKeys(response, RESERVATION_KEYS) || !isUuid(response.id) || !isUuid(response.roomId) || !isUuid(response.primaryGuestId) || !Object.hasOwn(RESERVATION_STATUS_LABELS, response.status) || !validInterval(response.checkInAt, response.checkOutAt) || !isPositiveInteger(response.guestCount) || !isDecimal(response.nightlyRate) || !isDecimal(response.totalAmount) || !isUtcTimestamp(response.createdAt) || !isUtcTimestamp(response.updatedAt)) failContract();
  return { ...response };
}
export function adaptReservationListResponse(response) { if (!Array.isArray(response)) failContract(); const records = response.map(adaptReservationResponse); if (new Set(records.map((record) => record.id)).size !== records.length) failContract(); return records; }
export function adaptReservationAvailabilityResponse(response) {
  if (!hasExactKeys(response, AVAILABILITY_KEYS) || !validInterval(response.checkInAt, response.checkOutAt) || !isPositiveInteger(response.durationMinutes) || !isPositiveInteger(response.guestCount) || !hasExactKeys(response.policy, POLICY_KEYS) || typeof response.policy.timezone !== 'string' || !/^\d\d:\d\d$/.test(response.policy.dayUseStart) || !/^\d\d:\d\d$/.test(response.policy.dayUseEnd) || !isPositiveInteger(response.policy.dayUseMinimumMinutes) || !isPositiveInteger(response.policy.reservationIntervalMinutes) || !Array.isArray(response.rooms)) failContract();
  const rooms = response.rooms.map((room) => {
    if (!hasExactKeys(room, AVAILABLE_ROOM_KEYS) || !isUuid(room.roomId) || !isUuid(room.categoryId) || typeof room.number !== 'string' || !room.number.trim() || room.number.length > 16 || !Number.isSafeInteger(room.floor) || !isPositiveInteger(room.capacity) || room.capacity < response.guestCount || room.operationalStatus !== 'available' || !isDecimal(room.nightlyRate) || !isDecimal(room.totalAmount)) failContract();
    return { ...room };
  });
  if (new Set(rooms.map((room) => room.roomId)).size !== rooms.length) failContract();
  return { ...response, rooms };
}
export function buildReservationAvailabilityQuery(input) {
  if (!hasExactKeys(input, QUERY_KEYS) || !validInterval(input.checkInAt, input.checkOutAt)) throw new Error('Ingrese un intervalo UTC válido.');
  const guestCount = typeof input.guestCount === 'string' && /^[1-9]\d*$/.test(input.guestCount) ? Number(input.guestCount) : input.guestCount;
  if (!isPositiveInteger(guestCount)) throw new Error('Ingrese una cantidad válida de huéspedes.');
  return { checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount };
}
export function buildReservationCreateDto(input) {
  if (!hasExactKeys(input, CREATE_KEYS) || !isUuid(input.roomId) || !isUuid(input.primaryGuestId)) throw new Error('Seleccione una habitación y un huésped válidos.');
  return { roomId: input.roomId, primaryGuestId: input.primaryGuestId, ...buildReservationAvailabilityQuery({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: input.guestCount }) };
}
export function adaptReservationCreateResponse(response, request) {
  const reservation = adaptReservationResponse(response);
  if (reservation.status !== 'pending' || reservation.roomId !== request.roomId || reservation.primaryGuestId !== request.primaryGuestId || reservation.checkInAt !== request.checkInAt || reservation.checkOutAt !== request.checkOutAt || reservation.guestCount !== request.guestCount) failContract();
  return reservation;
}
