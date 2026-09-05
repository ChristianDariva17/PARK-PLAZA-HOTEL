const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_14_2_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const ISO_TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;
const CATEGORY_KEYS = ['baseNightlyRate', 'capacity', 'code', 'createdAt', 'id', 'name'];
const ROOM_KEYS = ['category', 'createdAt', 'floor', 'id', 'number', 'status'];
const INVENTORY_KEYS = ['categories', 'rooms'];
const INVALID_RESPONSE_MESSAGE = 'El servidor devolvió datos de habitaciones no válidos. Intente nuevamente.';

export class RoomContractError extends Error {
  constructor() {
    super(INVALID_RESPONSE_MESSAGE);
    this.name = 'RoomContractError';
    this.code = 'invalid_response';
    this.status = null;
    this.reloadRecommended = true;
  }
}

export const ROOM_STATUS_LABELS = Object.freeze({
  available: 'Disponible',
  reserved: 'Reservada',
  occupied: 'Ocupada',
  cleaning: 'En limpieza',
  maintenance: 'En mantenimiento',
  blocked: 'Bloqueada',
  out_of_service: 'Fuera de servicio',
});

const ROOM_STATUS_CODES = Object.freeze(Object.fromEntries(Object.entries(ROOM_STATUS_LABELS).map(([code, label]) => [label, code])));

const failContract = () => { throw new RoomContractError(); };
const hasExactKeys = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).toSorted();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
};
const isBoundedText = (value, maximum) => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const isIsoTimestamp = (value) => {
  if (typeof value !== 'string') return false;
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === match[1];
};
const categoriesEqual = (left, right) => (
  left.id === right.id
  && left.code === right.code
  && left.name === right.name
  && left.capacity === right.capacity
  && left.baseNightlyRate === right.baseNightlyRate
  && left.createdAt === right.createdAt
);

export function roomStatusToLabel(status) {
  const label = ROOM_STATUS_LABELS[status];
  if (!label) failContract();
  return label;
}

export function roomStatusToCode(label) {
  const code = ROOM_STATUS_CODES[label];
  if (!code) throw new Error('El estado de habitación no es válido.');
  return code;
}

export function adaptRoomCategoryResponse(category) {
  if (!hasExactKeys(category, CATEGORY_KEYS)
    || !UUID_PATTERN.test(category.id)
    || !isBoundedText(category.code, 32)
    || !isBoundedText(category.name, 100)
    || !Number.isInteger(category.capacity)
    || category.capacity <= 0
    || typeof category.baseNightlyRate !== 'string'
    || !DECIMAL_14_2_PATTERN.test(category.baseNightlyRate)
    || !isIsoTimestamp(category.createdAt)) failContract();
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    capacity: category.capacity,
    baseNightlyRate: category.baseNightlyRate,
    createdAt: category.createdAt,
  };
}

export function adaptRoomResponse(room) {
  if (!hasExactKeys(room, ROOM_KEYS)
    || !UUID_PATTERN.test(room.id)
    || !isBoundedText(room.number, 16)
    || !Number.isFinite(room.floor)
    || !Number.isInteger(room.floor)
    || !Object.hasOwn(ROOM_STATUS_LABELS, room.status)
    || !isIsoTimestamp(room.createdAt)) failContract();
  const category = adaptRoomCategoryResponse(room.category);
  return {
    id: room.id,
    number: room.number,
    floor: room.floor,
    status: roomStatusToLabel(room.status),
    statusCode: room.status,
    createdAt: room.createdAt,
    categoryId: category.id,
    category: category.name,
    capacity: category.capacity,
    nightlyRate: category.baseNightlyRate,
  };
}

export function adaptRoomMutationResponse(response, expectedRoomId) {
  if (!UUID_PATTERN.test(String(expectedRoomId || ''))) failContract();
  const room = adaptRoomResponse(response);
  if (room.id !== expectedRoomId) failContract();
  return room;
}

export function adaptRoomCategoryMutationResponse(response, expectedCategoryId) {
  if (!UUID_PATTERN.test(String(expectedCategoryId || ''))) failContract();
  const category = adaptRoomCategoryResponse(response);
  if (category.id !== expectedCategoryId) failContract();
  return category;
}

export function adaptRoomInventoryResponse(response) {
  if (!hasExactKeys(response, INVENTORY_KEYS) || !Array.isArray(response.rooms) || !Array.isArray(response.categories)) failContract();
  const categories = response.categories.map(adaptRoomCategoryResponse);
  const categoriesById = new Map();
  for (const category of categories) {
    if (categoriesById.has(category.id)) failContract();
    categoriesById.set(category.id, category);
  }
  const rooms = response.rooms.map((roomResponse) => {
    const room = adaptRoomResponse(roomResponse);
    const catalogCategory = categoriesById.get(room.categoryId);
    if (!catalogCategory || !categoriesEqual(catalogCategory, roomResponse.category)) failContract();
    return room;
  });
  return { rooms, categories };
}

export function buildRoomPatch(current, input) {
  const patch = {};
  const number = input.number?.trim();
  const floor = Number(input.floor);
  if (number !== current.number) patch.number = number;
  if (floor !== current.floor) patch.floor = floor;
  if (input.categoryId !== current.categoryId) patch.categoryId = input.categoryId;
  return Object.keys(patch).length ? patch : null;
}

export function buildCategoryPatch(current, input) {
  const patch = {};
  const name = input.name?.trim();
  const code = input.code?.trim();
  const capacity = input.capacity !== undefined ? Number(input.capacity) : undefined;
  const baseNightlyRate = input.baseNightlyRate !== undefined ? Number(input.baseNightlyRate).toFixed(2) : undefined;
  if (name && name !== current.name) patch.name = name;
  if (code && code !== current.code) patch.code = code;
  if (capacity && capacity !== current.capacity) patch.capacity = capacity;
  if (baseNightlyRate && baseNightlyRate !== current.baseNightlyRate) patch.baseNightlyRate = baseNightlyRate;
  return Object.keys(patch).length ? patch : null;
}

export function selectRoomById(state, roomId) {
  if (!UUID_PATTERN.test(String(roomId || ''))) return undefined;
  return state.rooms.find((room) => room.id === roomId);
}

export function displayRoomReference(state, roomId) {
  const room = selectRoomById(state, roomId);
  return room ? `Habitación ${room.number}` : 'Habitación no disponible';
}
