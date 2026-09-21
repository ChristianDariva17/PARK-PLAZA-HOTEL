import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const petPassModalSource = readFileSync(new URL('./PetPassModal.jsx', import.meta.url), 'utf8');
const petsViewSource = readFileSync(new URL('./PetsView.jsx', import.meta.url), 'utf8');
const petsModelSource = readFileSync(new URL('./petsModel.js', import.meta.url), 'utf8');

describe('Pets Enhancements Contract and Integration', () => {
  it('PetPassModal supports QR pass, vaccination badge, kit badge, and print button', () => {
    expect(petPassModalSource).toContain('Pase y Carnet Pet-Friendly');
    expect(petPassModalSource).toContain('QR Check');
    expect(petPassModalSource).toContain('Vacunas al Día');
    expect(petPassModalSource).toContain('Kit Entregado');
    expect(petPassModalSource).toContain('Imprimir Pase (80mm / A4)');
    expect(petPassModalSource).toContain('Normas de Convivencia Pet-Friendly');
  });

  it('PetEditor in PetsView supports dual mode (Huésped vs Cliente Externo) and quick rates', () => {
    expect(petsViewSource).toContain('Huésped de Habitación');
    expect(petsViewSource).toContain('Cliente Externo / Restaurante / Guardería');
    expect(petsViewSource).toContain('Carnet de Vacunación y Antirrábica al día verificado');
    expect(petsViewSource).toContain('Kit de Bienvenida entregado');
    expect(petsViewSource).toContain('Pase de Día (S/ 15)');
    expect(petsViewSource).toContain('Por Noche (S/ 35)');
    expect(petsViewSource).toContain('Spa / Limpieza Ozono (S/ 50)');
  });

  it('PetsView renders pet metrics, search bar, and pass modal trigger', () => {
    expect(petsViewSource).toContain('Programa Pet-Friendly · Control Sanitario y Convivencia');
    expect(petsViewSource).toContain('Vacunación Verificada');
    expect(petsViewSource).toContain('Kits Entregados');
    expect(petsViewSource).toContain('Pase Pet-Friendly');
    expect(petsViewSource).toContain('PetPassModal');
  });

  it('petsModel supports visitor pet fields and vaccination mapping', () => {
    expect(petsModelSource).toContain('originType');
    expect(petsModelSource).toContain('vaccinationVerified');
    expect(petsModelSource).toContain('welcomeKitDelivered');
    expect(petsModelSource).toContain('emergencyContact');
    expect(petsModelSource).toContain('temperament');
  });
});
