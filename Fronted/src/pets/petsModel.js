const nextPetId = (records) => {
  const highest = records.reduce((maximum, record) => {
    const match = /^PET-(\d+)$/.exec(record.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `PET-${String(highest + 1).padStart(3, '0')}`;
};

export const adaptPetResponse = (dto) => ({ ...dto, charge: Number(dto.charge) });

const petFields = (input) => ({
  stayId: input.stayId || null,
  clientId: input.clientId,
  name: input.name,
  type: input.type,
  size: input.size,
  lodgingPlace: input.lodgingPlace,
  charge: Number(input.charge),
  ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  ...(input.damageIncidentId?.trim() ? { damageIncidentId: input.damageIncidentId.trim() } : {}),
});

export const buildPetCreateDto = (state, input) => ({ id: nextPetId(state.pets), ...petFields(input) });
export const buildPetUpdateDto = (input) => petFields(input);
