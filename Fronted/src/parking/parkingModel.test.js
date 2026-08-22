import { describe, expect, it } from 'vitest';
import { adaptVehicleResponse, buildVehicleCreateDto, buildVehicleUpdateDto } from './parkingModel.js';

const state = {
  vehicles: [{ id: 'VEH-009', stayId: 'stay-id', clientId: 'client-id', roomId: 'room-id', entryResponsible: 'Ana' }],
  stays: [{ id: 'stay-id', reservationId: 'reservation-id', roomId: 'room-id' }],
  reservations: [{ id: 'reservation-id', primaryGuestId: 'client-id' }],
};

describe('parking API mapping', () => {
  it('derives linked identities from the selected stay and maps UI type to vehicleType', () => {
    expect(buildVehicleCreateDto(state, { payload: { stayId: 'stay-id', plate: 'abc', space: 'a1', fee: '15', type: 'Auto', brandModel: 'Sedan' }, responsible: 'Ana' })).toEqual({
      id: 'VEH-010', stayId: 'stay-id', clientId: 'client-id', roomId: 'room-id', plate: 'abc', space: 'a1', fee: 15, vehicleType: 'Auto', brandModel: 'Sedan', entryResponsible: 'Ana',
    });
  });

  it('projects only the strict update contract and adapts server numeric values', () => {
    const body = buildVehicleUpdateDto(state, { vehicleId: 'VEH-009', payload: { plate: 'DEF', space: 'B2', fee: '20', type: 'Moto', brandModel: 'Road' }, responsible: 'Other' });
    expect(body).toEqual({ stayId: 'stay-id', clientId: 'client-id', roomId: 'room-id', plate: 'DEF', space: 'B2', fee: 20, vehicleType: 'Moto', brandModel: 'Road', entryResponsible: 'Ana' });
    expect(adaptVehicleResponse({ id: 'VEH-009', vehicleType: 'Moto', fee: '20.00' })).toMatchObject({ type: 'Moto', fee: 20 });
  });
});
