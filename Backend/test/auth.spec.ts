import { describe, expect, it } from 'vitest';
import { CryptoService } from '../src/auth/crypto.service.js';
import { parseChangePasswordDto } from '../src/auth/dto/change-password.dto.js';
import { parseLoginDto } from '../src/auth/dto/login.dto.js';

describe('authentication primitives', () => {
  it('normalizes login input without exposing schema details', () => {
    expect(parseLoginDto({ email: ' Admin@Example.com ', password: 'a password' })).toEqual({ email: 'Admin@Example.com', password: 'a password' });
    expect(() => parseLoginDto({ email: 'invalid', password: '' })).toThrow('Invalid request body');
    expect(() => parseLoginDto({ email: 'admin@example.com', password: 'a password', role: 'admin' })).toThrow('Invalid request body');
  });

  it('parses strict password-change bodies without altering passwords', () => {
    const input = { currentPassword: ' current password ', newPassword: ' new password ' };
    expect(parseChangePasswordDto(input)).toEqual(input);
    expect(() => parseChangePasswordDto({ ...input, accountId: '550e8400-e29b-41d4-a716-446655440000' })).toThrow('Invalid request body');
  });

  it('hashes passwords with random salts and verifies them', async () => {
    const crypto = new CryptoService();
    const first = await crypto.hashPassword('a sufficiently long password');
    const second = await crypto.hashPassword('a sufficiently long password');
    expect(first).not.toBe(second);
    await expect(crypto.verifyPassword('a sufficiently long password', first)).resolves.toBe(true);
    await expect(crypto.verifyPassword('wrong password', first)).resolves.toBe(false);
  });

  it('stores only deterministic token digests', () => {
    const crypto = new CryptoService();
    const token = crypto.createOpaqueToken();
    expect(token).not.toBe(crypto.hashToken(token));
    expect(crypto.hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });
});
