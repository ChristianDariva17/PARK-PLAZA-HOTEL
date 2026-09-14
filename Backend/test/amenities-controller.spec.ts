import { describe, expect, it } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../src/auth/decorators/require-permissions.decorator.js';
import { AmenitiesController } from '../src/amenities/amenities.controller.js';

describe('AmenitiesController permissions', () => {
  it('keeps reads separate from amenity mutations', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AmenitiesController.prototype.getConfigs)).toEqual(['amenities.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AmenitiesController.prototype.updateConfig)).toEqual(['amenities.config']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AmenitiesController.prototype.createBlock)).toEqual(['amenities.block']);
  });

  it('requires operational permissions for manual passes and settlement', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AmenitiesController.prototype.createManualPass)).toEqual(['amenities.create', 'cash.move']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AmenitiesController.prototype.settleReservation)).toEqual(['amenities.settle', 'cash.move']);
  });
});
