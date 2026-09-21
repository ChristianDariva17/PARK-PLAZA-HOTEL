import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeofenceService } from '../src/attendance/geofence.service.js';
import { DynamicQrService } from '../src/attendance/dynamic-qr.service.js';
import { AttendanceService } from '../src/attendance/attendance.service.js';
import { BadRequestException } from '@nestjs/common';

function queryContainsColumn(value: unknown, columnName: string, seen = new Set<object>()): boolean {
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;
  seen.add(value);
  if (Reflect.get(value, 'name') === columnName) return true;
  return Reflect.ownKeys(value).some((key) => queryContainsColumn(Reflect.get(value, key), columnName, seen));
}

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
    process.env.ATTENDANCE_QR_SECRET = Buffer.alloc(32, 1).toString('base64');
    service = new DynamicQrService({} as any);
  });

  it('accepts a database dependency for persistent nonce consumption', () => {
    expect(service).toBeInstanceOf(DynamicQrService);
  });

  it('generates a valid signed kiosk token', () => {
    const result = service.generateKioskToken(propertyId, 20);
    expect(result.token).toBeDefined();
    expect(result.token.split('.').length).toBe(2);
    expect(result.refreshIntervalMs).toBe(20000);
  });

  it('verifies a valid token without consuming it', () => {
    const { token } = service.generateKioskToken(propertyId, 20);
    const verified = service.verifyToken(token, propertyId);
    expect(verified.propertyId).toBe(propertyId);
    expect(verified.nonce).toBeDefined();
    expect(verified.issuedAt).toBeInstanceOf(Date);
  });

  it('prevents replay attack through the persistent nonce executor', async () => {
    const { token } = service.generateKioskToken(propertyId, 20);
    const verified = service.verifyToken(token, propertyId);
    const returning = vi.fn()
      .mockResolvedValueOnce([{ nonce: verified.nonce }])
      .mockResolvedValueOnce([]);
    const transaction = {
      insert: vi.fn(() => ({
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        returning,
      })),
    };

    await service.consumeToken(transaction as any, verified);
    await expect(service.consumeToken(transaction as any, verified)).rejects.toThrow(BadRequestException);
  });

  it('rejects token for a different property', () => {
    const { token } = service.generateKioskToken(propertyId, 20);
    const otherPropertyId = '22222222-2222-4222-8222-222222222222';
    expect(() => service.verifyToken(token, otherPropertyId)).toThrow(BadRequestException);
  });

  it('rejects tampered token', () => {
    const { token } = service.generateKioskToken(propertyId, 20);
    const [payload, sig] = token.split('.');
    const tampered = `${payload}.${sig}tampered`;
    expect(() => service.verifyToken(tampered, propertyId)).toThrow();
  });
});

describe('AttendanceService QR staff binding', () => {
  it('resolves self-service QR attendance through the authenticated account staff link', async () => {
    const propertyId = '11111111-1111-4111-8111-111111111111';
    const linkedStaffId = 'staff-linked-to-account';
    const unrelatedStaffId = 'first-unrelated-staff';
    const event = { id: 'attendance-event', staffId: linkedStaffId, movement: 'Ingreso' };
    const selectResults = [
      [],
      [{ id: linkedStaffId }],
      [{ id: linkedStaffId }],
      [],
      [],
      [],
    ];
    const where = vi.fn(() => {
      const rows = selectResults.shift() ?? [];
      const resolved = Promise.resolve(rows);
      return Object.assign(resolved, {
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
      });
    });
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where })) }));
    const insert = vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([event]) })),
    }));
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select,
      insert,
    };
    const database = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ latitude: null, longitude: null, geofenceRadiusMeters: null }]) })),
        })),
      })),
      transaction: vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx)),
    };
    const qr = {
      verifyToken: vi.fn().mockReturnValue({ propertyId, nonce: 'nonce', issuedAt: new Date() }),
      consumeToken: vi.fn().mockResolvedValue(undefined),
    };
    const geofence = { validateGeofence: vi.fn().mockReturnValue({ isValid: true, distanceMeters: 1, allowedRadiusMeters: 80 }) };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new AttendanceService(database as any, audit as any, geofence as any, qr as any);

    await expect(service.reportQrAttendance(
      {
        accountId: 'account-1',
        propertyId,
        roleKey: 'receptionist',
        email: 'staff@example.invalid',
        permissions: [],
        sessionId: 'session-1',
        passwordChangeRequired: false,
      },
      { qrToken: 'signed-token', latitude: 0, longitude: 0, idempotencyKey: 'qr-key' },
      {},
    )).resolves.toEqual(expect.objectContaining({ staffId: linkedStaffId }));

    expect(insert).toHaveBeenCalled();
    expect(insert.mock.results[0]!.value.values).toHaveBeenCalledWith(expect.objectContaining({
      staffId: linkedStaffId,
      movement: 'Ingreso',
    }));
    expect(insert.mock.results[0]!.value.values).not.toHaveBeenCalledWith(expect.objectContaining({ staffId: unrelatedStaffId }));
    expect(queryContainsColumn(where.mock.calls[1]?.[0], 'account_id')).toBe(true);
    expect(queryContainsColumn(where.mock.calls[1]?.[0], 'property_id')).toBe(true);
  });
});
