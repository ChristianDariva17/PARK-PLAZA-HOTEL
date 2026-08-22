import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Environment } from '../config/environment.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { accounts, permissions, rolePermissions, roles, sessions } from '../database/schema/index.js';
import { acquireAccountTransactionLock } from '../database/transaction-policy.js';
import type { AuthenticatedAccount, RequestContext } from './auth.types.js';
import { CryptoService } from './crypto.service.js';

@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly config: ConfigService<Environment, true>,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async create(accountId: string, propertyId: string, context: RequestContext): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
    const token = this.crypto.createOpaqueToken();
    const expiresAt = new Date(Date.now() + this.config.get('AUTH_SESSION_MAX_HOURS', { infer: true }) * 3_600_000);
    const result = await this.database.transaction(async (tx) => {
      await acquireAccountTransactionLock(tx, accountId);
      const replaced = await tx.update(sessions).set({ revokedAt: new Date(), revocationReason: 'replaced' }).where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt))).returning({ id: sessions.id });
      const inserted = await tx.insert(sessions).values({ accountId, tokenHash: this.crypto.hashToken(token), expiresAt, ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}), ...(context.userAgent ? { userAgent: context.userAgent } : {}) }).returning({ id: sessions.id });
      const sessionId = inserted[0]!.id;
      if (replaced.length) await this.audit.recordMany(replaced.map(({ id }) => this.sessionAudit('auth.session.replaced', accountId, propertyId, id, context)), tx);
      await this.audit.record(this.sessionAudit('auth.login.succeeded', accountId, propertyId, sessionId, context), tx);
      return inserted[0]!.id;
    });
    return { token, sessionId: result, expiresAt };
  }

  async resolve(token: string, context: RequestContext): Promise<AuthenticatedAccount | null> {
    const tokenHash = this.crypto.hashToken(token);
    const idleCutoff = new Date(Date.now() - this.config.get('AUTH_SESSION_IDLE_MINUTES', { infer: true }) * 60_000);
    const rows = await this.database.select({
      sessionId: sessions.id, accountId: accounts.id, propertyId: accounts.propertyId, email: accounts.email,
      roleKey: roles.key, accountStatus: accounts.status, passwordChangeRequired: accounts.passwordChangeRequired, lastSeenAt: sessions.lastSeenAt, expiresAt: sessions.expiresAt,
    }).from(sessions).innerJoin(accounts, eq(sessions.accountId, accounts.id)).innerJoin(roles, eq(accounts.roleId, roles.id))
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt))).limit(1);
    const row = rows[0];
    if (!row) return null;
    const now = new Date();
    if (row.accountStatus !== 'active') {
      await this.revokeById(row.sessionId, 'account_disabled', row.accountId, row.propertyId, context);
      return null;
    }
    if (row.expiresAt <= now || row.lastSeenAt <= idleCutoff) {
      const reason = row.expiresAt <= now ? 'expired' : 'idle_timeout';
      await this.revokeById(row.sessionId, reason, row.accountId, row.propertyId, context);
      return null;
    }
    const touched = await this.database.update(sessions).set({ lastSeenAt: now }).where(and(eq(sessions.id, row.sessionId), isNull(sessions.revokedAt), gt(sessions.expiresAt, sql`now()`), gt(sessions.lastSeenAt, idleCutoff))).returning({ id: sessions.id });
    if (!touched.length) {
      await this.revokeById(row.sessionId, row.expiresAt <= new Date() ? 'expired' : 'idle_timeout', row.accountId, row.propertyId, context);
      return null;
    }
    const granted = await this.database.select({ key: permissions.key }).from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id)).where(eq(roles.key, row.roleKey));
    return { sessionId: row.sessionId, accountId: row.accountId, propertyId: row.propertyId, email: row.email, roleKey: row.roleKey, permissions: granted.map((item) => item.key), passwordChangeRequired: row.passwordChangeRequired };
  }

  async revokeAllForAccount(accountId: string, propertyId: string, reason: string, context: RequestContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      await acquireAccountTransactionLock(tx, accountId);
      const changed = await tx.update(sessions).set({ revokedAt: new Date(), revocationReason: reason })
        .where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt))).returning({ id: sessions.id });
      if (changed.length) await this.audit.recordMany(changed.map(({ id }) => this.sessionAudit(`auth.session.${reason}`, accountId, propertyId, id, context)), tx);
    });
  }

  async revoke(token: string | undefined, reason: string, context: RequestContext): Promise<void> {
    if (!token) return;
    const rows = await this.database.select({ id: sessions.id, accountId: sessions.accountId, propertyId: accounts.propertyId, expiresAt: sessions.expiresAt, lastSeenAt: sessions.lastSeenAt })
      .from(sessions).innerJoin(accounts, eq(sessions.accountId, accounts.id))
      .where(and(eq(sessions.tokenHash, this.crypto.hashToken(token)), isNull(sessions.revokedAt))).limit(1);
    const row = rows[0];
    if (!row) return;
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - this.config.get('AUTH_SESSION_IDLE_MINUTES', { infer: true }) * 60_000);
    const effectiveReason = row.expiresAt <= now ? 'expired' : row.lastSeenAt <= idleCutoff ? 'idle_timeout' : reason;
    await this.revokeById(row.id, effectiveReason, row.accountId, row.propertyId, context);
  }

  private async revokeById(sessionId: string, reason: string, accountId: string, propertyId: string, context: RequestContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      const changed = await tx.update(sessions).set({ revokedAt: new Date(), revocationReason: reason }).where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt))).returning({ id: sessions.id });
      if (changed.length) await this.audit.record(this.sessionAudit(`auth.session.${reason}`, accountId, propertyId, sessionId, context), tx);
    });
  }

  private sessionAudit(eventType: string, accountId: string, propertyId: string, sessionId: string, context: RequestContext) {
    return {
      eventType, actorAccountId: accountId, propertyId, subjectType: 'session', subjectId: sessionId,
      ...(context.requestId ? { requestId: context.requestId } : {}),
      ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
    };
  }
}
