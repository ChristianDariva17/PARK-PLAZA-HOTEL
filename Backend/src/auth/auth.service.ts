import { BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import type { Environment } from '../config/environment.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { accountIdentities, accounts, googleAccessRequests, roles, sessions } from '../database/schema/index.js';
import { acquireAccountTransactionLock } from '../database/transaction-policy.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { AuthenticatedAccount, RequestContext } from './auth.types.js';
import { CryptoService } from './crypto.service.js';
import { LoginDefenseService } from './login-defense.service.js';
import { SessionService } from './session.service.js';
import { PasswordPolicyService } from './password-policy.service.js';
import type { GoogleLoginDto } from './dto/google-login.dto.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash: Promise<string>;
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly crypto: CryptoService,
    private readonly defense: LoginDefenseService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly google: GoogleTokenVerifier,
    private readonly config: ConfigService<Environment, true>,
  ) { this.dummyPasswordHash = this.crypto.hashPassword('not-a-real-account-password'); }

  async login(input: LoginDto, context: RequestContext) {
    const email = input.email.trim().toLowerCase();
    try {
      await this.defense.assertAllowed(context.ipAddress ?? 'unknown', email);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      await this.audit.record({ ...context, eventType: 'auth.login.failed', subjectType: 'account', metadata: { emailHash: this.crypto.hashLoginKey(email), blocked: true } });
      await new Promise((resolve) => setTimeout(resolve, 250));
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const rows = await this.database.select({ id: accounts.id, propertyId: accounts.propertyId, email: accounts.email, passwordHash: accounts.passwordHash, status: accounts.status, roleKey: roles.key })
      .from(accounts).innerJoin(roles, eq(accounts.roleId, roles.id)).where(eq(accounts.email, email)).limit(1);
    const account = rows[0];
    const passwordHash = account?.passwordHash ?? await this.dummyPasswordHash;
    const passwordMatches = await this.crypto.verifyPassword(input.password, passwordHash);
    const valid = account?.status === 'active' && passwordMatches;
    if (!valid) {
      const delay = await this.defense.registerFailure(context.ipAddress ?? 'unknown', email);
      await this.audit.record({ ...context, eventType: 'auth.login.failed', subjectType: 'account', metadata: { emailHash: this.crypto.hashLoginKey(email) } });
      await new Promise((resolve) => setTimeout(resolve, delay));
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    await this.defense.clearAccount(email);
    const session = await this.sessions.create(account.id, account.propertyId, context);
    return { account: { id: account.id, propertyId: account.propertyId, email: account.email, role: account.roleKey }, ...session };
  }

  async loginGoogle(input: GoogleLoginDto, nonceHash: string | undefined, context: RequestContext) {
    const identity = await this.google.verify(input.credential, nonceHash);
    const linked = await this.database.select({
      accountId: accounts.id, propertyId: accounts.propertyId, email: accounts.email, status: accounts.status, roleKey: roles.key,
    }).from(accountIdentities)
      .innerJoin(accounts, eq(accountIdentities.accountId, accounts.id))
      .innerJoin(roles, eq(accounts.roleId, roles.id))
      .where(and(eq(accountIdentities.provider, 'google'), eq(accountIdentities.providerSubject, identity.subject))).limit(1);

    if (linked[0]) {
      const account = linked[0];
      if (account.status !== 'active') {
        await this.audit.record({ ...context, eventType: 'auth.google.login.failed', subjectType: 'account', subjectId: account.accountId, propertyId: account.propertyId, metadata: { reason: 'account_disabled' } });
        throw new ForbiddenException('Google account is disabled');
      }
      await this.database.update(accountIdentities).set({ email: identity.email, lastUsedAt: new Date() })
        .where(and(eq(accountIdentities.provider, 'google'), eq(accountIdentities.providerSubject, identity.subject)));
      await this.audit.record({ ...context, eventType: 'auth.google.login.succeeded', actorAccountId: account.accountId, subjectType: 'account', subjectId: account.accountId, propertyId: account.propertyId });
      const session = await this.sessions.create(account.accountId, account.propertyId, context);
      return { status: 'authenticated' as const, account: { id: account.accountId, propertyId: account.propertyId, email: account.email, role: account.roleKey }, ...session };
    }

    const registrationPropertyId = this.config.get('GOOGLE_REGISTRATION_PROPERTY_ID', { infer: true });
    if (!registrationPropertyId) throw new ServiceUnavailableException('Google registration is not configured');
    let request = await this.database.select({ id: googleAccessRequests.id, status: googleAccessRequests.status })
      .from(googleAccessRequests).where(eq(googleAccessRequests.providerSubject, identity.subject)).limit(1);
    let created = false;
    if (!request[0]) {
      const inserted = await this.database.insert(googleAccessRequests).values({
        propertyId: registrationPropertyId, providerSubject: identity.subject, email: identity.email, displayName: identity.displayName,
      }).onConflictDoNothing().returning({ id: googleAccessRequests.id, status: googleAccessRequests.status });
      request = inserted.length ? inserted : await this.database.select({ id: googleAccessRequests.id, status: googleAccessRequests.status })
        .from(googleAccessRequests).where(eq(googleAccessRequests.providerSubject, identity.subject)).limit(1);
      created = inserted.length > 0;
    }
    const accessRequest = request[0]!;
    if (created) await this.audit.record({ ...context, eventType: 'auth.google.registration_requested', subjectType: 'google_access_request', subjectId: accessRequest.id, propertyId: registrationPropertyId, metadata: { email: identity.email } });
    if (accessRequest.status === 'rejected') throw new ForbiddenException('Google access request was rejected');
    if (accessRequest.status !== 'pending') throw new UnauthorizedException('Google account is not available');
    return { status: 'pending' as const, message: 'Tu solicitud fue enviada para revisión administrativa.' };
  }

  async changePassword(account: AuthenticatedAccount, input: ChangePasswordDto, context: RequestContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await acquireAccountTransactionLock(tx, account.accountId);
      const rows = await tx.select({ passwordHash: accounts.passwordHash }).from(accounts).where(eq(accounts.id, account.accountId)).limit(1).for('update');
      if (!rows[0]?.passwordHash || !await this.crypto.verifyPassword(input.currentPassword, rows[0].passwordHash)) throw new UnauthorizedException('Current password is incorrect');
      if (await this.crypto.verifyPassword(input.newPassword, rows[0].passwordHash)) throw new BadRequestException('New password must be different');
      await this.passwordPolicy.assertAcceptable(input.newPassword);
      const passwordHash = await this.crypto.hashPassword(input.newPassword);
      await tx.update(accounts).set({ passwordHash, passwordChangeRequired: false, updatedAt: new Date() }).where(eq(accounts.id, account.accountId));
      const revoked = await tx.update(sessions).set({ revokedAt: new Date(), revocationReason: 'password_changed' })
        .where(and(eq(sessions.accountId, account.accountId), isNull(sessions.revokedAt))).returning({ id: sessions.id });
      await this.audit.recordMany([
        { ...context, eventType: 'auth.password.changed', actorAccountId: account.accountId, subjectType: 'account', subjectId: account.accountId, propertyId: account.propertyId },
        ...revoked.map(({ id }) => ({ ...context, eventType: 'auth.session.password_changed', actorAccountId: account.accountId, subjectType: 'session', subjectId: id, propertyId: account.propertyId })),
      ], tx);
    });
  }
}
