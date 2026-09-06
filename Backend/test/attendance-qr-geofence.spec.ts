import { describe, it, expect, beforeEach } from 'vitest';
import { GeofenceService } from '../src/attendance/geofence.service.js';
import { DynamicQrService } from '../src/attendance/dynamic-qr.service.js';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('GeofenceService', () => {
  let service: GeofenceService;

  beforeEach(() => {
    service = new GeofenceService();
  });

  it('calculates distance correctly between known coordinates', () => {
    // Distance from point A to point B (~111 km per degree of latitude)
    const distance = service.calculateDistanceMeters(0, 0, 1, 0);
    expect(Math.round(distance / 1000)).toBeCloseTo(111, 0);
  });

  it('validates user inside hotel perimeter (within 80m)', () => {
    const hotelLat = -12.0864;
    const hotelLon = -77.0321;
    // ~10 meters away
    const userLat = -12.08645;
    const userLon = -77.03215;

    const result = service.validateGeofence(hotelLat, hotelLon, 80, userLat, userLon, 10);
    expect(result.isValid).toBe(true);
    expect(result.distanceMeters).toBeLessThan(80);
  });

  it('rejects user outside hotel perimeter (> 80m)', () => {
    const hotelLat = -12.0864;
    const hotelLon = -77.0321;
    // ~1 km away
    const userLat = -12.0950;
    const userLon = -77.0321;

    const result = service.validateGeofence(hotelLat, hotelLon, 80, userLat, userLon, 10);
    expect(result.isValid).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(80);
    expect(result.message).toContain('Estás a');
  });
});

describe('DynamicQrService', () => {
  let service: DynamicQrService;
  const propertyId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    service = new DynamicQrService(Buffer.alloc(32, 1).toString('base64'));
  });

  it('generates a valid signed kiosk token', () => {
    const result = service.generateKioskToken(propertyId, 20);
    expect(result.token).toBeDefined();
    expect(result.token.split('.').length).toBe(2);
    expect(result.refreshIntervalMs).toBe(20000);
  });

  it('verifies and consumes a valid token', () => {
    const { token } = service.generateKioskToken(propertyId, 20);
    const consumed = service.verifyAndConsumeToken(token, propertyId);
    expect(consumed.propertyId).toBe(propertyId);
    expect(consumed.timestamp).toBeInstanceOf(Date);
  });

  it('prevents replay attack when reusing the same token', () => {
    const { token } = service.generateKioskToken(propertyId, 20);
    service.verifyAndConsumeToken(token, propertyId);

    // Second consumption must fail
    expect(() => service.verifyAndConsumeToken(token, propertyId)).toThrow(BadRequestException);
  });

  it('rejects token for a different property', () => {
    const { token } = service.generateKioskToken(propertyId, 20);
    const otherPropertyId = '22222222-2222-4222-8222-222222222222';
    expect(() => service.verifyAndConsumeToken(token, otherPropertyId)).toThrow(BadRequestException);
  });

  it('rejects tampered token', () => {
    const { token } = service.generateKioskToken(propertyId, 20);
    const [payload, sig] = token.split('.');
    const tampered = `${payload}.${sig}tampered`;
    expect(() => service.verifyAndConsumeToken(tampered, propertyId)).toThrow();
  });
});
