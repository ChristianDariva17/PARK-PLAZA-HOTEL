import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ExperiencesController } from '../src/experiences/experiences.controller.js';
import { parseReportQrAttendanceDto } from '../src/attendance/attendance.dto.js';
import { parseCreateSupplierDto } from '../src/suppliers/suppliers.dto.js';
import { BridgeCapabilityService } from '../src/attendance/bridge-capability.service.js';

const account = {
  accountId: 'account-id',
  propertyId: 'property-a',
  roleKey: 'administrator',
  email: 'admin@example.com',
  permissions: ['experiences.read'],
  sessionId: 'session-id',
  passwordChangeRequired: false,
};

describe('Phase 1 security boundaries', () => {
  it('rejects a property route that differs from the authenticated session', async () => {
    const service = { listExperiences: vi.fn() };
    const controller = new ExperiencesController(service as any);

    await expect(controller.listExperiences('property-b', account, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.listExperiences).not.toHaveBeenCalled();
  });

  it('translates invalid Zod request payloads into HTTP 400 exceptions', () => {
    expect(() => parseReportQrAttendanceDto({ qrToken: 'short' })).toThrow(BadRequestException);
    expect(() => parseCreateSupplierDto({ legalName: 'Supplier', taxId: '12345678901', unexpected: true })).toThrow(BadRequestException);
  });

  it('binds biometric capabilities to their property', () => {
    process.env.BIOMETRIC_BRIDGE_CAPABILITY_SECRET = 'phase-one-test-secret-at-least-32-characters';
    const service = new BridgeCapabilityService();
    const subject = { type: 'employee' as const, id: '11111111-1111-4111-8111-111111111111' };
    const capability = service.issue('verify', subject, 'property-a');

    expect(() => service.verify(capability.token, 'verify', subject, 'property-b')).toThrow('property mismatch');
  });
});
