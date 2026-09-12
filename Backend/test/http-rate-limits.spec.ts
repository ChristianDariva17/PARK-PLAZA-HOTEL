import { describe, expect, it } from 'vitest';
import { AttendanceController } from '../src/attendance/attendance.controller.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { CustomerAuthController } from '../src/customer/customer-auth.controller.js';
import { HealthController } from '../src/health/health.controller.js';

const limitFor = (handler: object) => Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
const ttlFor = (handler: object) => Reflect.getMetadata('THROTTLER:TTLdefault', handler);

describe('HTTP rate limits', () => {
  it('strictly limits credential exchanges and bridge capability issuance', () => {
    expect(limitFor(AuthController.prototype.login)).toBe(5);
    expect(limitFor(AuthController.prototype.google)).toBe(5);
    expect(limitFor(CustomerAuthController.prototype.exchange)).toBe(10);
    expect(limitFor(AttendanceController.prototype.issueBiometricCapability)).toBe(10);
    expect(ttlFor(AuthController.prototype.login)).toBe(60_000);
  });

  it('does not throttle liveness and readiness probes', () => {
    expect(Reflect.getMetadata('THROTTLER:SKIPdefault', HealthController)).toBe(true);
  });
});
