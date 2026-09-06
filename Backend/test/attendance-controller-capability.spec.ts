import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceController } from '../src/attendance/attendance.controller.js';

const actor = {
  accountId: 'account-1',
  propertyId: 'property-1',
  roleKey: 'manager',
  email: 'manager@example.com',
  sessionId: 'session-1',
  passwordChangeRequired: false,
};

describe('AttendanceController biometric capabilities', () => {
  it('issues a subject-bound verification capability only to authorized staff', async () => {
    const issue = vi.fn().mockReturnValue({ token: 'capability', expiresAt: '2026-09-05T00:00:00.000Z' });
    const controller = new AttendanceController({} as any, { issue } as any);

    await expect(controller.issueBiometricCapability({
      operation: 'verify', subjectType: 'employee', subjectId: '11111111-1111-4111-8111-111111111111',
    }, { ...actor, permissions: ['staff.biometric', 'staff.attendance'] })).resolves.toEqual({ token: 'capability', expiresAt: '2026-09-05T00:00:00.000Z' });

    expect(issue).toHaveBeenCalledWith('verify', { type: 'employee', id: '11111111-1111-4111-8111-111111111111' });
  });

  it('rejects a biometric operation when the session lacks its permission', async () => {
    const controller = new AttendanceController({} as any, { issue: vi.fn() } as any);

    await expect(controller.issueBiometricCapability({
      operation: 'enroll', subjectType: 'client', subjectId: '11111111-1111-4111-8111-111111111111',
    }, { ...actor, permissions: ['staff.attendance'] })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
