import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { BridgeCapabilityService } from '../src/attendance/bridge-capability.service.js';

const secret = 'biometric-bridge-test-secret-at-least-32-characters';

describe('BridgeCapabilityService', () => {
  it('issues a signed, subject-bound capability that expires in one minute', () => {
    const result = new BridgeCapabilityService(secret).issue('verify', { type: 'employee', id: '11111111-1111-4111-8111-111111111111' });
    const [payload, signature] = result.token.split('.');
    const decoded = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'));

    expect(decoded).toMatchObject({ op: 'verify', st: 'employee', sid: '11111111-1111-4111-8111-111111111111' });
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(signature).toBe(createHmac('sha256', secret).update(payload!).digest('base64url'));
  });

  it('rejects an expired capability', () => {
    const service = new BridgeCapabilityService(secret);
    const issued = service.issue('verify', { type: 'employee', id: '11111111-1111-4111-8111-111111111111' });
    const [payload, signature] = issued.token.split('.');
    const expiredPayload = Buffer.from(JSON.stringify({
      op: 'verify', st: 'employee', sid: '11111111-1111-4111-8111-111111111111', exp: Math.floor(Date.now() / 1000) - 1, jti: 'expired',
    })).toString('base64url');
    const expiredSignature = createHmac('sha256', secret).update(expiredPayload).digest('base64url');

    expect(payload).toBeTruthy();
    expect(signature).toBeTruthy();
    expect(() => service.verify(`${expiredPayload}.${expiredSignature}`, 'verify', { type: 'employee', id: '11111111-1111-4111-8111-111111111111' })).toThrow('Expired');
  });
});
