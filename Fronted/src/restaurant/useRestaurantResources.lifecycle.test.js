import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INITIAL_RESTAURANT_RESOURCE_KEYS, RESTAURANT_RESOURCE_DEFINITIONS, RESTAURANT_RESOURCE_KEYS } from './useRestaurantResources.js';

const source = readFileSync(new URL('./useRestaurantResources.js', import.meta.url), 'utf8');

describe('restaurant resource controller', () => {
  it('owns every restaurant read resource and keeps domain adapters explicit', () => {
    expect(RESTAURANT_RESOURCE_KEYS).toEqual(['menu', 'orders', 'inventory', 'inventoryLedger']);
    expect(INITIAL_RESTAURANT_RESOURCE_KEYS).toEqual(['orders', 'inventory']);
    expect(Object.keys(RESTAURANT_RESOURCE_DEFINITIONS)).toEqual(RESTAURANT_RESOURCE_KEYS);
    expect(RESTAURANT_RESOURCE_DEFINITIONS.orders).toMatchObject({ permission: 'orders.read', domainKey: 'orders' });
    expect(RESTAURANT_RESOURCE_DEFINITIONS.inventoryLedger).toMatchObject({ permission: 'inventory.read', domainKey: 'inventoryLedger' });
  });

  it('keeps identity isolation, permission gates and abortable generations in the feature boundary', () => {
    expect(source).toContain('const resourceRefs = useRef');
    expect(source).toContain('const controller = new AbortController()');
    expect(source).toContain('generation !== currentRef.generation');
    expect(source).toContain('RESOURCE_ACCESS_FORBIDDEN');
    expect(source).toContain('RESTAURANT_RESOURCES_RESET');
    expect(source).toContain('INITIAL_RESTAURANT_RESOURCE_KEYS');
    expect(source).toContain('identityKey');
    expect(source).toContain('if (!controller) return;');
    expect(source).toContain('currentRef.controller = null');
    expect(source).toContain('return { reloadResource }');
  });
});
