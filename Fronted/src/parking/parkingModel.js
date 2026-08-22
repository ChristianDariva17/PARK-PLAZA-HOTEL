const nextRecordId = (prefix, records) => {
  const highest = records.reduce((maximum, record) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(record.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
};

export const adaptVehicleResponse = (dto) => ({
  ...dto,
  type: dto.vehicleType,
  fee: Number(dto.fee),
});

export function buildVehicleCreateDto(state, action) {
  const stay = state.stays.find((item) => item.id === action.payload.stayId);
  const reservation = state.reservations.find((item) => item.id === stay?.reservationId);
  return {
    id: nextRecordId('VEH', state.vehicles),
    stayId: action.payload.stayId,
    clientId: stay?.clientId || reservation?.primaryGuestId,
    roomId: stay?.roomId,
    plate: action.payload.plate,
    space: action.payload.space,
    fee: Number(action.payload.fee),
    vehicleType: action.payload.type,
    brandModel: action.payload.brandModel,
    entryResponsible: action.responsible,
  };
}

export function buildVehicleUpdateDto(state, action) {
  const current = state.vehicles.find((item) => item.id === action.vehicleId);
  return {
    stayId: current.stayId,
    clientId: current.clientId,
    roomId: current.roomId,
    plate: action.payload.plate,
    space: action.payload.space,
    fee: Number(action.payload.fee),
    vehicleType: action.payload.type,
    brandModel: action.payload.brandModel,
    entryResponsible: current.entryResponsible || action.responsible,
  };
}
