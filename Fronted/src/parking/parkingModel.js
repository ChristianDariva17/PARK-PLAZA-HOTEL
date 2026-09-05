import { selectActiveStays } from '../domain/hotelModel.js';

const nextRecordId = (prefix, records) => {
  const highest = (records || []).reduce((maximum, record) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(record.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
};

export const adaptVehicleResponse = (dto) => ({
  ...dto,
  type: dto.vehicleType,
  fee: Number(dto.fee),
  color: dto.vehicleColor || null,
});

export function buildVehicleCreateDto(state, action) {
  const activeStays = selectActiveStays(state);
  const stay = action.payload.stayId
    ? activeStays.find((item) => item.id === action.payload.stayId || item.roomId === action.payload.stayId)
      || (state.stays || []).find((item) => item.id === action.payload.stayId)
    : null;
  const reservation = stay
    ? (state.persistentReservations || state.reservations || []).find((item) => item.id === stay.reservationId)
    : null;

  return {
    id: nextRecordId('VEH', state.vehicles),
    stayId: stay?.id || action.payload.stayId || null,
    clientId: stay?.clientId || reservation?.primaryGuestId || null,
    roomId: stay?.roomId || null,
    originType: action.payload.originType || (action.payload.stayId ? 'stay' : 'visitor'),
    driverName: action.payload.driverName || null,
    driverPhone: action.payload.driverPhone || null,
    vehicleColor: action.payload.color || action.payload.vehicleColor || null,
    keysLeft: Boolean(action.payload.keysLeft),
    entryNotes: action.payload.entryNotes || null,
    plate: action.payload.plate,
    space: action.payload.space,
    fee: Number(action.payload.fee) || 0,
    vehicleType: action.payload.type,
    brandModel: action.payload.brandModel || null,
    entryResponsible: action.responsible,
  };
}

export function buildVehicleUpdateDto(state, action) {
  const current = state.vehicles.find((item) => item.id === action.vehicleId);
  return {
    stayId: action.payload.stayId !== undefined ? action.payload.stayId : current.stayId,
    clientId: current.clientId,
    roomId: current.roomId,
    originType: action.payload.originType || current.originType,
    driverName: action.payload.driverName !== undefined ? action.payload.driverName : current.driverName,
    driverPhone: action.payload.driverPhone !== undefined ? action.payload.driverPhone : current.driverPhone,
    vehicleColor: action.payload.color !== undefined ? action.payload.color : current.vehicleColor,
    keysLeft: action.payload.keysLeft !== undefined ? Boolean(action.payload.keysLeft) : current.keysLeft,
    entryNotes: action.payload.entryNotes !== undefined ? action.payload.entryNotes : current.entryNotes,
    plate: action.payload.plate,
    space: action.payload.space,
    fee: action.payload.fee !== undefined ? Number(action.payload.fee) : current.fee,
    vehicleType: action.payload.type || current.type,
    brandModel: action.payload.brandModel,
    entryResponsible: current.entryResponsible || action.responsible,
  };
}
