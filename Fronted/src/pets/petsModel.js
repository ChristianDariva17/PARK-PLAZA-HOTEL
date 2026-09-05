import { selectActiveStays } from '../domain/hotelModel.js';

const nextPetId = (records) => {
  const highest = records.reduce((maximum, record) => {
    const match = /^PET-(\d+)$/.exec(record.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `PET-${String(highest + 1).padStart(3, '0')}`;
};

export const adaptPetResponse = (dto) => ({
  ...dto,
  charge: Number(dto.charge),
  vaccinationVerified: Boolean(dto.vaccinationVerified),
  welcomeKitDelivered: Boolean(dto.welcomeKitDelivered),
});

const createPetFields = (state, input) => {
  const originType = input.originType || (input.stayId ? 'stay' : 'visitor');
  const isStay = originType === 'stay' && Boolean(input.stayId);
  let stayId = null;
  let clientId = null;
  if (isStay) {
    const activeStays = selectActiveStays(state);
    const stay = activeStays.find((item) => item.id === input.stayId || item.roomId === input.stayId)
      || (state.stays || []).find((item) => item.id === input.stayId && ['Activa', 'active'].includes(item.status));
    const reservation = stay
      ? (state.persistentReservations || state.reservations || []).find((r) => r.id === stay.reservationId)
      : null;
    clientId = stay?.clientId || reservation?.primaryGuestId || input.clientId || (state.clients && state.clients[0]?.id) || null;
    if (!stay || !clientId) throw new Error('An active stay with a linked guest is required.');
    stayId = stay.id;
  }
  return {
    stayId,
    clientId: clientId || input.clientId || null,
    originType,
    ownerName: input.ownerName?.trim() || null,
    ownerPhone: input.ownerPhone?.trim() || null,
    name: input.name,
    type: input.type,
    breed: input.breed?.trim() || null,
    size: input.size,
    lodgingPlace: input.lodgingPlace,
    charge: Number(input.charge || 0),
    vaccinationVerified: Boolean(input.vaccinationVerified),
    temperament: input.temperament?.trim() || null,
    emergencyContact: input.emergencyContact?.trim() || null,
    welcomeKitDelivered: Boolean(input.welcomeKitDelivered),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.damageIncidentId?.trim() ? { damageIncidentId: input.damageIncidentId.trim() } : {}),
  };
};

const updatePetFields = (input) => ({
  name: input.name,
  type: input.type,
  breed: input.breed?.trim() || null,
  size: input.size,
  lodgingPlace: input.lodgingPlace,
  vaccinationVerified: Boolean(input.vaccinationVerified),
  temperament: input.temperament?.trim() || null,
  emergencyContact: input.emergencyContact?.trim() || null,
  welcomeKitDelivered: Boolean(input.welcomeKitDelivered),
  ownerName: input.ownerName?.trim() || null,
  ownerPhone: input.ownerPhone?.trim() || null,
  ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  ...(input.damageIncidentId?.trim() ? { damageIncidentId: input.damageIncidentId.trim() } : {}),
});

export const buildPetCreateDto = (state, input) => ({ id: nextPetId(state.pets), ...createPetFields(state, input) });
export const buildPetUpdateDto = (input) => updatePetFields(input);

