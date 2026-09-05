import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseParkPlazaMenu } from '../src/restaurant/menu-import.parser.js';

const source = readFileSync(new URL('../../menu_park_plaza.md', import.meta.url), 'utf8');

describe('Park Plaza menu parser', () => {
  it('normalizes the authoritative commercial source without inventing unsupported data', () => {
    const manifest = parseParkPlazaMenu(source);

    expect(manifest.currency).toBe('PEN');
    expect(manifest.stats).toEqual({ categoryCount: 15, productRowCount: 82, pricedOfferingCount: 90, unsupportedRowCount: 2 });
    expect(manifest.categories[0]?.name).toBe('Saltados y Chaufas');
    expect(manifest.categories.at(-1)?.name).toBe('Infusiones');

    const frappes = manifest.categories.find((category) => category.name === 'Frappes')!;
    expect(frappes.items.find((item) => item.name === 'Sublime')?.variants).toEqual([
      expect.objectContaining({ name: 'Mediano', price: '12.00', currency: 'PEN' }),
      expect.objectContaining({ name: 'Grande', price: '14.00', currency: 'PEN' }),
    ]);
    const broaster = manifest.categories.find((category) => category.name === 'Frituras')!.items.find((item) => item.name === 'Broaster')!;
    expect(broaster.variants).toEqual([expect.objectContaining({ name: null, price: null })]);
    const frozen = manifest.categories.find((category) => category.name === 'Refrescos')!.items.find((item) => item.name === 'Frozen')!;
    expect(frozen.variants.every((variant) => variant.price === null)).toBe(true);
  });

  it('produces stable source keys and digest for repeat imports', () => {
    const first = parseParkPlazaMenu(source);
    const second = parseParkPlazaMenu(source.replace(/\r\n/g, '\n'));

    expect(second.sourceDigest).toBe(first.sourceDigest);
    expect(second.categories.map((category) => category.sourceKey)).toEqual(first.categories.map((category) => category.sourceKey));
    expect(new Set(first.categories.flatMap((category) => category.items.map((item) => item.sourceKey))).size).toBe(82);
  });

  it('fails closed when the authoritative row counts or prices drift unexpectedly', () => {
    expect(() => parseParkPlazaMenu(source.replace('| Chaufa Amazónica | S/ 20.00 |', ''))).toThrow('Authoritative menu validation failed');
    expect(() => parseParkPlazaMenu(source.replace('S/ 20.00', '$20'))).toThrow('Unsupported menu price');
  });
});
