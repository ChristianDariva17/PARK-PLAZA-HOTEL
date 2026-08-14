import { describe, expect, it } from 'vitest';
import { parseAccountId, parseCreateAccountDto, parseResetPasswordDto, parseUpdateAccountDto } from '../src/accounts/accounts.dto.js';

describe('account management DTOs', () => {
  it('normalizes email input and preserves the cleaning role key', () => {
    expect(parseCreateAccountDto({ email: ' Cleaner@Example.com ', roleKey: 'cleaning', temporaryPassword: 'temporary password' })).toEqual({ email: 'cleaner@example.com', roleKey: 'cleaning', temporaryPassword: 'temporary password' });
  });
  it('supports explicit personnel unlinking and rejects empty updates', () => {
    expect(parseUpdateAccountDto({ personnelId: null })).toEqual({ personnelId: null });
    expect(() => parseUpdateAccountDto({})).toThrow('Invalid request body');
  });
  it('rejects unexpected secret-shaped fields', () => {
    expect(() => parseResetPasswordDto({ temporaryPassword: 'valid input value', passwordHash: 'must-not-pass' })).toThrow('Invalid request body');
  });
  it('accepts only UUID account route parameters', () => {
    expect(parseAccountId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(() => parseAccountId('not-a-uuid')).toThrow('Invalid request body');
  });
});
