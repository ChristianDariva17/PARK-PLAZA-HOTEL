import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const petPassModalSource = readFileSync(new URL('./PetPassModal.jsx', import.meta.url), 'utf8');
const p1ViewsSource = readFileSync(new URL('../components/views/P1Views.jsx', import.meta.url), 'utf8');
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

  it('PetEditor in P1Views supports dual mode (Huésped vs Cliente Externo) and quick rates', () => {
    expect(p1ViewsSource).toContain('Huésped de Habitación');
    expect(p1ViewsSource).toContain('Cliente Externo / Restaurante / Guardería');
    expect(p1ViewsSource).toContain('Carnet de Vacunación y Antirrábica al día verificado');
    expect(p1ViewsSource).toContain('Kit de Bienvenida entregado');
    expect(p1ViewsSource).toContain('Pase de Día (S/ 15)');
    expect(p1ViewsSource).toContain('Por Noche (S/ 35)');
    expect(p1ViewsSource).toContain('Spa / Limpieza Ozono (S/ 50)');
  });

  it('P1PetsView renders pet metrics, search bar, and pass modal trigger', () => {
    expect(p1ViewsSource).toContain('Programa Pet-Friendly · Control Sanitario y Convivencia');
    expect(p1ViewsSource).toContain('Vacunación Verificada');
    expect(p1ViewsSource).toContain('Kits Entregados');
    expect(p1ViewsSource).toContain('Pase Pet-Friendly');
    expect(p1ViewsSource).toContain('PetPassModal');
  });

  it('petsModel supports visitor pet fields and vaccination mapping', () => {
    expect(petsModelSource).toContain('originType');
    expect(petsModelSource).toContain('vaccinationVerified');
    expect(petsModelSource).toContain('welcomeKitDelivered');
    expect(petsModelSource).toContain('emergencyContact');
    expect(petsModelSource).toContain('temperament');
  });
});
