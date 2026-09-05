import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import { CryptoService } from '../auth/crypto.service.js';
import type { Environment } from '../config/environment.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { customerAccounts, customerSessions, properties } from '../database/schema/index.js';
import { acquireCustomerTransactionLock } from '../database/transaction-policy.js';
import type { FirebaseIdentity, FirebaseTokenVerifier } from './firebase-token-verifier.js';
import { FIREBASE_TOKEN_VERIFIER } from './customer.tokens.js';
import type { AuthenticatedCustomer } from './customer.types.js';

export interface CustomerSessionResult {
  token: string;
  expiresAt: Date;
  customer: Omit<AuthenticatedCustomer, 'propertyId' | 'sessionId'>;
}

@Injectable()
export class CustomerAuthService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly config: ConfigService<Environment, true>,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(FIREBASE_TOKEN_VERIFIER) private readonly firebase: FirebaseTokenVerifier,
  ) {}

  async exchange(idToken: string, context: RequestContext): Promise<CustomerSessionResult> {
    let identity: FirebaseIdentity;
    try {
      identity = await this.firebase.verify(idToken);
    } catch {
      throw new UnauthorizedException('Firebase identity could not be verified');
    }
    const token = this.crypto.createOpaqueToken();
    const expiresAt = new Date(Date.now() + this.config.get('CUSTOMER_SESSION_MAX_DAYS', { infer: true }) * 86_400_000);
    const propertyId = this.propertyId();
    const result = await this.database.transaction(async (tx) => {
      await acquireCustomerTransactionLock(tx, identity.subject);
      const propertyRows = await tx.select({ id: properties.id }).from(properties).where(eq(properties.id, propertyId)).limit(1);
      if (!propertyRows[0]) throw new Error('Configured customer portal property does not exist');
      const accountRows = await tx.insert(customerAccounts).values({
        firebaseSubject: identity.subject,
        email: identity.email,
        displayName: identity.displayName,
        photoUrl: identity.photoUrl,
      }).onConflictDoUpdate({
        target: customerAccounts.firebaseSubject,
        set: { email: identity.email, displayName: identity.displayName, photoUrl: identity.photoUrl, updatedAt: new Date() },
      }).returning({ id: customerAccounts.id, status: customerAccounts.status, email: customerAccounts.email, displayName: customerAccounts.displayName, photoUrl: customerAccounts.photoUrl });
      const customer = accountRows[0]!;
      if (customer.status !== 'active') throw new UnauthorizedException('Customer account is disabled');
      await tx.update(customerSessions).set({ revokedAt: new Date(), revocationReason: 'replaced' })
        .where(and(eq(customerSessions.customerAccountId, customer.id), isNull(customerSessions.revokedAt)));
      const sessionRows = await tx.insert(customerSessions).values({
        customerAccountId: customer.id,
        tokenHash: this.crypto.hashToken(token),
        expiresAt,
        ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
        ...(context.userAgent ? { userAgent: context.userAgent } : {}),
      }).returning({ id: customerSessions.id });
      await this.audit.record({
        ...context,
        eventType: 'customer.login.succeeded',
        subjectType: 'customer_session',
        subjectId: sessionRows[0]!.id,
        propertyId,
        metadata: { customerAccountId: customer.id },
      }, tx);
      return { customer, sessionId: sessionRows[0]!.id };
    });
    return {
      token,
      expiresAt,
      customer: {
        customerAccountId: result.customer.id,
        email: result.customer.email,
        displayName: result.customer.displayName,
        photoUrl: result.customer.photoUrl,
      },
    };
  }

  async resolve(token: string, context: RequestContext): Promise<AuthenticatedCustomer | null> {
    const rows = await this.database.select({
      sessionId: customerSessions.id,
      customerAccountId: customerAccounts.id,
      email: customerAccounts.email,
      displayName: customerAccounts.displayName,
      photoUrl: customerAccounts.photoUrl,
      status: customerAccounts.status,
      lastSeenAt: customerSessions.lastSeenAt,
      expiresAt: customerSessions.expiresAt,
    }).from(customerSessions).innerJoin(customerAccounts, eq(customerSessions.customerAccountId, customerAccounts.id))
      .where(and(eq(customerSessions.tokenHash, this.crypto.hashToken(token)), isNull(customerSessions.revokedAt))).limit(1);
    const row = rows[0];
    if (!row) return null;
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - this.config.get('CUSTOMER_SESSION_IDLE_HOURS', { infer: true }) * 3_600_000);
    if (row.status !== 'active' || row.expiresAt <= now || row.lastSeenAt <= idleCutoff) {
      await this.revokeById(row.sessionId, row.status !== 'active' ? 'account_disabled' : row.expiresAt <= now ? 'expired' : 'idle_timeout', row.customerAccountId, context);
      return null;
    }
    const touched = await this.database.update(customerSessions).set({ lastSeenAt: now }).where(and(
      eq(customerSessions.id, row.sessionId), isNull(customerSessions.revokedAt), gt(customerSessions.expiresAt, sql`now()`), gt(customerSessions.lastSeenAt, idleCutoff),
    )).returning({ id: customerSessions.id });
    if (!touched[0]) return null;
    return { sessionId: row.sessionId, customerAccountId: row.customerAccountId, propertyId: this.propertyId(), email: row.email, displayName: row.displayName, photoUrl: row.photoUrl };
  }

  async revoke(token: string | undefined, context: RequestContext): Promise<void> {
    if (!token) return;
    const rows = await this.database.select({ id: customerSessions.id, customerAccountId: customerSessions.customerAccountId })
      .from(customerSessions).where(and(eq(customerSessions.tokenHash, this.crypto.hashToken(token)), isNull(customerSessions.revokedAt))).limit(1);
    if (rows[0]) await this.revokeById(rows[0].id, 'logout', rows[0].customerAccountId, context);
  }

  private async revokeById(sessionId: string, reason: string, customerAccountId: string, context: RequestContext): Promise<void> {
    await this.database.transaction(async (tx) => {
      const changed = await tx.update(customerSessions).set({ revokedAt: new Date(), revocationReason: reason })
        .where(and(eq(customerSessions.id, sessionId), isNull(customerSessions.revokedAt))).returning({ id: customerSessions.id });
      if (changed[0]) await this.audit.record({
        ...context,
        eventType: `customer.session.${reason}`,
        subjectType: 'customer_session',
        subjectId: sessionId,
        propertyId: this.propertyId(),
        metadata: { customerAccountId },
      }, tx);
    });
  }

  private propertyId(): string {
    return this.config.get('CUSTOMER_PORTAL_PROPERTY_ID', { infer: true });
  }
}
