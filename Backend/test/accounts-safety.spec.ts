import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertAccountTransitionSafe, assertPersonnelAvailable } from '../src/accounts/accounts.safety.js';

const transition = { actorAccountId: 'actor', targetAccountId: 'target', currentStatus: 'active', currentRoleKey: 'administrator', nextStatus: 'active', nextRoleKey: 'administrator', activeAdministratorCount: 1 } as const;

describe('account management safety rules', () => {
  it('prevents an administrator from disabling their own account', () => {
    expect(() => assertAccountTransitionSafe({ ...transition, targetAccountId: 'actor', nextStatus: 'disabled' })).toThrow(ForbiddenException);
  });

  it('prevents disabling or demoting the last active administrator', () => {
    expect(() => assertAccountTransitionSafe({ ...transition, nextStatus: 'disabled' })).toThrow(ConflictException);
    expect(() => assertAccountTransitionSafe({ ...transition, nextRoleKey: 'receptionist' })).toThrow(ConflictException);
  });

  it('allows a transition when another active administrator remains', () => {
    expect(() => assertAccountTransitionSafe({ ...transition, nextRoleKey: 'cleaning', activeAdministratorCount: 2 })).not.toThrow();
  });

  it('only allows an unlinked same-property personnel row selected by the transaction', () => {
    expect(() => assertPersonnelAvailable('personnel-id', 'personnel-id')).not.toThrow();
    expect(() => assertPersonnelAvailable('personnel-id')).toThrow(ConflictException);
    expect(() => assertPersonnelAvailable('personnel-id', 'other-id')).toThrow(ConflictException);
  });
});
