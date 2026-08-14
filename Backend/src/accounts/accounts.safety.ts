import { ConflictException, ForbiddenException } from '@nestjs/common';

interface AccountTransition {
  actorAccountId: string;
  targetAccountId: string;
  currentStatus: 'active' | 'disabled';
  currentRoleKey: string;
  nextStatus: 'active' | 'disabled';
  nextRoleKey: string;
  activeAdministratorCount: number;
}

export function assertAccountTransitionSafe(input: AccountTransition): void {
  if (input.actorAccountId === input.targetAccountId && input.nextStatus === 'disabled') throw new ForbiddenException('You cannot disable your own account');
  const removesActiveAdministrator = input.currentStatus === 'active' && input.currentRoleKey === 'administrator'
    && (input.nextStatus !== 'active' || input.nextRoleKey !== 'administrator');
  if (removesActiveAdministrator && input.activeAdministratorCount <= 1) throw new ConflictException('The last active administrator cannot be disabled or demoted');
}

export function assertPersonnelAvailable(personnelId: string, availableId?: string): void {
  if (availableId !== personnelId) throw new ConflictException('Personnel record is unavailable or already linked');
}
