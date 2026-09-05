import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { CryptoService } from '../auth/crypto.service.js';
import { PasswordPolicyService } from '../auth/password-policy.service.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { getPostgresErrorFields } from '../database/postgres-error.js';
import { accountIdentities, accounts, googleAccessRequests, roles, sessions, staff } from '../database/schema/index.js';
import { acquirePropertyThenAccountTransactionLocks, acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type { ApproveGoogleRequestDto, CreateAccountDto, ResetPasswordDto, UpdateAccountDto } from './accounts.dto.js';
import { assertAccountTransitionSafe } from './accounts.safety.js';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly crypto: CryptoService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string) {
    const [accountRows, roleRows, personnelRows, requestRows] = await Promise.all([
      this.database.select({
        id: accounts.id, email: accounts.email, status: accounts.status, passwordChangeRequired: accounts.passwordChangeRequired,
        hasPassword: accounts.passwordHash, googleEmail: accountIdentities.email,
        createdAt: accounts.createdAt, updatedAt: accounts.updatedAt, roleKey: roles.key, roleName: roles.name,
        personnelId: staff.id, personnelFirstName: staff.firstName, personnelLastName: staff.lastName,
      }).from(accounts).innerJoin(roles, eq(accounts.roleId, roles.id)).leftJoin(staff, eq(staff.accountId, accounts.id))
        .leftJoin(accountIdentities, and(eq(accountIdentities.accountId, accounts.id), eq(accountIdentities.provider, 'google')))
        .where(eq(accounts.propertyId, propertyId)).orderBy(asc(accounts.email)),
      this.database.select({ key: roles.key, name: roles.name }).from(roles).orderBy(asc(roles.name)),
      this.database.select({ id: staff.id, accountId: staff.accountId, firstName: staff.firstName, lastName: staff.lastName })
        .from(staff).where(eq(staff.propertyId, propertyId)).orderBy(asc(staff.lastName), asc(staff.firstName)),
      this.database.select({ id: googleAccessRequests.id, email: googleAccessRequests.email, displayName: googleAccessRequests.displayName, requestedAt: googleAccessRequests.requestedAt })
        .from(googleAccessRequests).where(and(eq(googleAccessRequests.propertyId, propertyId), eq(googleAccessRequests.status, 'pending'))).orderBy(desc(googleAccessRequests.requestedAt)),
    ]);
    return {
      accounts: accountRows.map((item) => ({
        id: item.id, email: item.email, status: item.status, passwordChangeRequired: item.passwordChangeRequired,
        hasPassword: Boolean(item.hasPassword), googleEmail: item.googleEmail,
        createdAt: item.createdAt, updatedAt: item.updatedAt, role: { key: item.roleKey, name: item.roleName },
        personnel: item.personnelId ? { id: item.personnelId, firstName: item.personnelFirstName!, lastName: item.personnelLastName! } : null,
      })),
      roles: roleRows,
      personnel: personnelRows,
      googleRequests: requestRows,
    };
  }

  async create(actor: AuthenticatedAccount, input: CreateAccountDto, context: RequestContext) {
    await this.passwordPolicy.assertAcceptable(input.temporaryPassword);
    const passwordHash = await this.crypto.hashPassword(input.temporaryPassword);
    try {
      const accountId = await this.database.transaction(async (tx) => {
        await acquirePropertyTransactionLock(tx, actor.propertyId);
        const role = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, input.roleKey)).limit(1);
        if (!role[0]) throw new BadRequestException('Unknown role');
        const created = await tx.insert(accounts).values({
          propertyId: actor.propertyId, roleId: role[0].id, email: input.email, passwordHash,
          passwordChangeRequired: true, status: 'active',
        }).returning({ id: accounts.id });
        const id = created[0]!.id;
        if (input.personnelId) await this.claimPersonnel(tx, actor.propertyId, id, input.personnelId);
        await this.audit.record({
          ...this.auditBase(actor, context), eventType: 'account.created', subjectType: 'account', subjectId: id,
          metadata: { email: input.email, roleKey: input.roleKey, personnelId: input.personnelId ?? null },
        }, tx);
        return id;
      });
      return (await this.list(actor.propertyId)).accounts.find((item) => item.id === accountId)!;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async update(actor: AuthenticatedAccount, accountId: string, input: UpdateAccountDto, context: RequestContext) {
    let revokeReason: string | null = null;
    try {
      await this.database.transaction(async (tx) => {
        await acquirePropertyThenAccountTransactionLocks(tx, actor.propertyId, accountId);
        const rows = await tx.select({ id: accounts.id, roleId: accounts.roleId, roleKey: roles.key, status: accounts.status, email: accounts.email })
          .from(accounts).innerJoin(roles, eq(accounts.roleId, roles.id))
          .where(and(eq(accounts.id, accountId), eq(accounts.propertyId, actor.propertyId))).limit(1).for('update');
        const current = rows[0];
        if (!current) throw new NotFoundException('Account not found');
        const nextStatus = input.status ?? current.status;
        let nextRoleId = current.roleId;
        let nextRoleKey = current.roleKey;
        if (input.roleKey !== undefined) {
          const role = await tx.select({ id: roles.id, key: roles.key }).from(roles).where(eq(roles.key, input.roleKey)).limit(1);
          if (!role[0]) throw new BadRequestException('Unknown role');
          nextRoleId = role[0].id;
          nextRoleKey = role[0].key;
        }
        const activeAdministrators = await tx.select({ id: accounts.id }).from(accounts).innerJoin(roles, eq(accounts.roleId, roles.id))
          .where(and(eq(accounts.propertyId, actor.propertyId), eq(accounts.status, 'active'), eq(roles.key, 'administrator'))).for('update');
        assertAccountTransitionSafe({
          actorAccountId: actor.accountId, targetAccountId: accountId,
          currentStatus: current.status, currentRoleKey: current.roleKey,
          nextStatus, nextRoleKey, activeAdministratorCount: activeAdministrators.length,
        });
        await tx.update(accounts).set({
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.roleKey !== undefined ? { roleId: nextRoleId } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedAt: new Date(),
        }).where(eq(accounts.id, accountId));
        if (input.personnelId !== undefined) {
          await tx.update(staff).set({ accountId: null, updatedAt: new Date() }).where(and(eq(staff.propertyId, actor.propertyId), eq(staff.accountId, accountId)));
          if (input.personnelId !== null) await this.claimPersonnel(tx, actor.propertyId, accountId, input.personnelId);
        }
        await this.audit.record({
          ...this.auditBase(actor, context), eventType: 'account.updated', subjectType: 'account', subjectId: accountId,
          metadata: { fields: Object.keys(input), roleKey: input.roleKey, status: input.status, personnelId: input.personnelId },
        }, tx);
        if (nextStatus === 'disabled' && current.status !== 'disabled') revokeReason = 'account_disabled';
        else if (nextRoleKey !== current.roleKey) revokeReason = 'role_changed';
        else if (input.email !== undefined && input.email !== current.email) revokeReason = 'email_changed';
        if (revokeReason) await this.revokeSessions(tx, actor, accountId, revokeReason, context);
      });
      return (await this.list(actor.propertyId)).accounts.find((item) => item.id === accountId)!;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async resetPassword(actor: AuthenticatedAccount, accountId: string, input: ResetPasswordDto, context: RequestContext): Promise<void> {
    if (accountId === actor.accountId) throw new ForbiddenException('You cannot reset your own password; use change password instead');
    await this.passwordPolicy.assertAcceptable(input.temporaryPassword);
    const passwordHash = await this.crypto.hashPassword(input.temporaryPassword);
    await this.database.transaction(async (tx) => {
      await acquirePropertyThenAccountTransactionLocks(tx, actor.propertyId, accountId);
      const changed = await tx.update(accounts).set({ passwordHash, passwordChangeRequired: true, updatedAt: new Date() })
        .where(and(eq(accounts.id, accountId), eq(accounts.propertyId, actor.propertyId))).returning({ id: accounts.id });
      if (!changed.length) throw new NotFoundException('Account not found');
      await this.audit.record({ ...this.auditBase(actor, context), eventType: 'account.password_reset', subjectType: 'account', subjectId: accountId }, tx);
      await this.revokeSessions(tx, actor, accountId, 'password_reset', context);
    });
  }

  async approveGoogleRequest(actor: AuthenticatedAccount, requestId: string, input: ApproveGoogleRequestDto, context: RequestContext) {
    try {
      const accountId = await this.database.transaction(async (tx) => {
        await acquirePropertyTransactionLock(tx, actor.propertyId);
        const requests = await tx.select({
          id: googleAccessRequests.id, email: googleAccessRequests.email, providerSubject: googleAccessRequests.providerSubject,
          status: googleAccessRequests.status,
        }).from(googleAccessRequests).where(and(eq(googleAccessRequests.id, requestId), eq(googleAccessRequests.propertyId, actor.propertyId))).limit(1).for('update');
        const accessRequest = requests[0];
        if (!accessRequest) throw new NotFoundException('Google access request not found');
        if (accessRequest.status !== 'pending') throw new ConflictException('Google access request is no longer pending');
        const role = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, input.roleKey)).limit(1);
        if (!role[0]) throw new BadRequestException('Unknown role');
        const created = await tx.insert(accounts).values({
          propertyId: actor.propertyId, roleId: role[0].id, email: accessRequest.email, passwordChangeRequired: false, status: 'active',
        }).returning({ id: accounts.id });
        const id = created[0]!.id;
        await tx.insert(accountIdentities).values({ accountId: id, provider: 'google', providerSubject: accessRequest.providerSubject, email: accessRequest.email });
        if (input.personnelId) await this.claimPersonnel(tx, actor.propertyId, id, input.personnelId);
        await tx.update(googleAccessRequests).set({
          status: 'approved', accountId: id, reviewedByAccountId: actor.accountId, reviewedAt: new Date(), updatedAt: new Date(),
        }).where(eq(googleAccessRequests.id, accessRequest.id));
        await this.audit.recordMany([
          { ...this.auditBase(actor, context), eventType: 'account.google_approved', subjectType: 'account', subjectId: id, metadata: { requestId: accessRequest.id, email: accessRequest.email, roleKey: input.roleKey, personnelId: input.personnelId ?? null } },
          { ...this.auditBase(actor, context), eventType: 'auth.google.registration_approved', subjectType: 'google_access_request', subjectId: accessRequest.id, metadata: { accountId: id } },
        ], tx);
        return id;
      });
      return (await this.list(actor.propertyId)).accounts.find((item) => item.id === accountId)!;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async rejectGoogleRequest(actor: AuthenticatedAccount, requestId: string, context: RequestContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      const changed = await tx.update(googleAccessRequests).set({
        status: 'rejected', reviewedByAccountId: actor.accountId, reviewedAt: new Date(), updatedAt: new Date(),
      }).where(and(eq(googleAccessRequests.id, requestId), eq(googleAccessRequests.propertyId, actor.propertyId), eq(googleAccessRequests.status, 'pending')))
        .returning({ id: googleAccessRequests.id });
      if (!changed.length) throw new NotFoundException('Google access request not found or is no longer pending');
      await this.audit.record({ ...this.auditBase(actor, context), eventType: 'auth.google.registration_rejected', subjectType: 'google_access_request', subjectId: requestId }, tx);
    });
  }

  private async claimPersonnel(tx: Parameters<Parameters<Database['transaction']>[0]>[0], propertyId: string, accountId: string, personnelId: string): Promise<void> {
    const available = await tx.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, personnelId), eq(staff.propertyId, propertyId), isNull(staff.accountId))).limit(1).for('update');
    if (!available.length) throw new ConflictException('Personnel record is unavailable or already linked');
    await tx.update(staff).set({ accountId, updatedAt: new Date() }).where(eq(staff.id, personnelId));
  }

  private async revokeSessions(tx: Parameters<Parameters<Database['transaction']>[0]>[0], actor: AuthenticatedAccount, accountId: string, reason: string, context: RequestContext): Promise<void> {
    const changed = await tx.update(sessions).set({ revokedAt: new Date(), revocationReason: reason })
      .where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt))).returning({ id: sessions.id });
    if (changed.length) await this.audit.recordMany(changed.map(({ id }) => ({
      ...this.auditBase(actor, context), eventType: `auth.session.${reason}`, subjectType: 'session', subjectId: id,
    })), tx);
  }

  private auditBase(actor: AuthenticatedAccount, context: RequestContext) {
    return {
      actorAccountId: actor.accountId, propertyId: actor.propertyId,
      ...(context.requestId ? { requestId: context.requestId } : {}),
      ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
    };
  }

  private rethrowConstraint(error: unknown): never {
    const postgresError = getPostgresErrorFields(error);
    if (postgresError?.code === '23505' && postgresError.constraint === 'accounts_email_unique') {
      throw new ConflictException('Email is already in use');
    }
    if (postgresError?.code === '23505' && postgresError.constraint === 'staff_account_id_key') {
      throw new ConflictException('Personnel record is unavailable or already linked');
    }
    throw error;
  }
}
