import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { FirebaseTokenVerifier } from '../src/customer/firebase-token-verifier.js';

const projectId = 'park-plaza-test';
const now = 1_900_000_000_000;
const nowSeconds = Math.floor(now / 1000);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function token(overrides: Record<string, unknown> = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: 'firebase-customer-id',
    email: 'Customer@Example.com',
    email_verified: true,
    name: 'Customer Name',
    exp: nowSeconds + 3600,
    iat: nowSeconds - 60,
    auth_time: nowSeconds - 120,
    ...overrides,
  })).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), privateKey).toString('base64url');
  return `${header}.${claims}.${signature}`;
}

describe('FirebaseTokenVerifier', () => {
  it('verifies signature and Firebase claims while honoring certificate caching', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue('public, max-age=3600') },
      json: vi.fn().mockResolvedValue({ 'test-key': publicKeyPem }),
    });
    const verifier = new FirebaseTokenVerifier(projectId, fetcher, () => now);
    await expect(verifier.verify(token())).resolves.toEqual({ subject: 'firebase-customer-id', email: 'customer@example.com', displayName: 'Customer Name', photoUrl: null });
    await expect(verifier.verify(token())).resolves.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fails closed on audience, time, algorithm, and certificate errors', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: vi.fn().mockReturnValue('max-age=0') }, json: vi.fn().mockResolvedValue({ 'test-key': publicKeyPem }) });
    const verifier = new FirebaseTokenVerifier(projectId, fetcher, () => now);
    await expect(verifier.verify(token({ aud: 'another-project' }))).rejects.toThrow('audience');
    await expect(verifier.verify(token({ exp: nowSeconds - 60 }))).rejects.toThrow('expired');
    await expect(verifier.verify(token({ email_verified: false }))).rejects.toThrow('not verified');
    await expect(verifier.verify('not-a-jwt')).rejects.toThrow('Invalid Firebase ID token');
    await expect(new FirebaseTokenVerifier(projectId, vi.fn().mockRejectedValue(new Error('offline')), () => now).verify(token())).rejects.toThrow('Unable to retrieve');
  });
});
