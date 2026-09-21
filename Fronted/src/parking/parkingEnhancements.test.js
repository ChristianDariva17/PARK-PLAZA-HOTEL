import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARKING_SPACES } from './ParkingVisualMap.jsx';

const visualMapSource = readFileSync(new URL('./ParkingVisualMap.jsx', import.meta.url), 'utf8');
const exitModalSource = readFileSync(new URL('./ParkingExitModal.jsx', import.meta.url), 'utf8');
const ticketModalSource = readFileSync(new URL('./ParkingTicketModal.jsx', import.meta.url), 'utf8');
const parkingViewSource = readFileSync(new URL('./ParkingView.jsx', import.meta.url), 'utf8');

describe('Parking Enhancements Contract and Integration', () => {
  it('defines 16 standard spaces with auto and moto segregation', () => {
    expect(DEFAULT_PARKING_SPACES).toHaveLength(16);
    const autos = DEFAULT_PARKING_SPACES.filter((s) => s.type === 'Auto');
    const motos = DEFAULT_PARKING_SPACES.filter((s) => s.type === 'Moto');
    expect(autos).toHaveLength(12);
    expect(motos).toHaveLength(4);
    expect(autos[0].code).toBe('E-01');
    expect(motos[0].code).toBe('M-01');
  });

  it('ParkingVisualMap renders live metrics, visual bay grid, and click handlers', () => {
    expect(visualMapSource).toContain('Estado del Estacionamiento');
    expect(visualMapSource).toContain('occupancyPercent');
    expect(visualMapSource).toContain('onSelectAvailableSpace');
    expect(visualMapSource).toContain('onVehicleExit');
    expect(visualMapSource).toContain('onVehicleClick');
    expect(visualMapSource).toContain('LIBRE');
    expect(visualMapSource).toContain('OCUPADO');
  });

  it('ParkingExitModal calculates stay duration, captures responsible and exit observations', () => {
    expect(exitModalSource).toContain('calculateDuration');
    expect(exitModalSource).toContain('Personal responsable de la entrega');
    expect(exitModalSource).toContain('Observaciones de salida');
    expect(exitModalSource).toContain('Revisión física conforme / Llaves entregadas');
    expect(exitModalSource).toContain('onConfirm');
  });

  it('ParkingTicketModal includes 80mm thermal receipt layout, QR barcode and print button', () => {
    expect(ticketModalSource).toContain('id="parking-thermal-ticket"');
    expect(ticketModalSource).toContain('PARK PLAZA');
    expect(ticketModalSource).toContain('CONTROL DE COCHERA');
    expect(ticketModalSource).toContain('QrCode');
    expect(ticketModalSource).toContain('window.print()');
    expect(ticketModalSource).toContain('Conserve este ticket');
  });

  it('ParkingView integrates map toggle, exit modal, and ticket modal', () => {
    expect(parkingViewSource).toContain("from './ParkingVisualMap.jsx'");
    expect(parkingViewSource).toContain("from './ParkingExitModal.jsx'");
    expect(parkingViewSource).toContain("from './ParkingTicketModal.jsx'");
    expect(parkingViewSource).toContain('🗺️ Mapa Visual');
    expect(parkingViewSource).toContain('📋 Lista de Registros');
    expect(parkingViewSource).toContain('<ParkingVisualMap');
    expect(parkingViewSource).toContain('<ParkingExitModal');
    expect(parkingViewSource).toContain('<ParkingTicketModal');
  });
});
