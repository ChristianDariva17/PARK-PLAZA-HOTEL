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
      id: 'VEH-010', stayId: 'stay-id', clientId: 'client-id', roomId: 'room-id', originType: 'stay', driverName: null, driverPhone: null, vehicleColor: null, keysLeft: false, entryNotes: null, plate: 'abc', space: 'a1', fee: 15, vehicleType: 'Auto', brandModel: 'Sedan', entryResponsible: 'Ana',
    });
  });

  it('builds external visitor vehicle DTO without stay links', () => {
    expect(buildVehicleCreateDto(state, { payload: { originType: 'restaurant', driverName: 'Juan Pérez', driverPhone: '999888777', vehicleColor: 'Rojo', keysLeft: true, entryNotes: 'Puerta rayada', plate: 'XYZ-789', space: 'E-03', fee: '5', type: 'Auto', brandModel: 'Corolla' }, responsible: 'Garita' })).toEqual({
      id: 'VEH-010', stayId: null, clientId: null, roomId: null, originType: 'restaurant', driverName: 'Juan Pérez', driverPhone: '999888777', vehicleColor: 'Rojo', keysLeft: true, entryNotes: 'Puerta rayada', plate: 'XYZ-789', space: 'E-03', fee: 5, vehicleType: 'Auto', brandModel: 'Corolla', entryResponsible: 'Garita',
    });
  });

  it('projects only the strict update contract and adapts server numeric values', () => {
    const body = buildVehicleUpdateDto(state, { vehicleId: 'VEH-009', payload: { plate: 'DEF', space: 'B2', fee: '20', type: 'Moto', brandModel: 'Road' }, responsible: 'Other' });
    expect(body).toEqual({ stayId: 'stay-id', clientId: 'client-id', roomId: 'room-id', plate: 'DEF', space: 'B2', fee: 20, vehicleType: 'Moto', brandModel: 'Road', entryResponsible: 'Ana' });
    expect(adaptVehicleResponse({ id: 'VEH-009', vehicleType: 'Moto', fee: '20.00' })).toMatchObject({ type: 'Moto', fee: 20 });
  });

  it('resolves active stay directly from occupied rooms when state.stays is empty', () => {
    const occupiedRoomsState = {
      vehicles: [],
      stays: [],
      persistentStays: [],
      rooms: [
        { id: 'room-101-uuid', number: '101', status: 'Ocupada', guestId: 'client-maria' },
        { id: 'room-102-uuid', number: '102', status: 'Ocupada', guestId: 'client-carlos' },
      ],
      clients: [
        { id: 'client-maria', name: 'María González' },
      ],
    };

    const dto = buildVehicleCreateDto(occupiedRoomsState, {
      payload: { stayId: 'EST-101', plate: 'ABC-123', space: 'E-01', fee: '0', type: 'Auto' },
      responsible: 'Recepción',
    });

    expect(dto).toMatchObject({
      stayId: 'EST-101',
      clientId: 'client-maria',
      roomId: 'room-101-uuid',
      originType: 'stay',
      plate: 'ABC-123',
    });
  });
});
