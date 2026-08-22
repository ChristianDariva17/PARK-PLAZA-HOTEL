import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { databaseUrlFromEnv, validateEnv } from '../config/environment.js';
import { accounts, auditEvents, properties, roles } from '../database/schema/index.js';
import { CompromisedPasswordService } from './compromised-password.service.js';
import { CryptoService } from './crypto.service.js';
import { PasswordPolicyService } from './password-policy.service.js';

const bootstrapSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  BOOTSTRAP_ADMIN_PASSWORD: z.string(),
  BOOTSTRAP_PROPERTY_CODE: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
  BOOTSTRAP_PROPERTY_NAME: z.string().trim().min(1).max(160),
});

const env = validateEnv(process.env);
const bootstrap = bootstrapSchema.parse(process.env);
const crypto = new CryptoService();
const policy = new PasswordPolicyService(new CompromisedPasswordService());
await policy.assertAcceptable(bootstrap.BOOTSTRAP_ADMIN_PASSWORD);
const pool = new Pool({ connectionString: databaseUrlFromEnv(env), ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false, max: 1 });
const database = drizzle(pool, { schema: { accounts, auditEvents, properties, roles } });
const audit = new AuditService(database);

try {
  await database.transaction(async (tx) => {
    const propertyRows = await tx.insert(properties).values({ code: bootstrap.BOOTSTRAP_PROPERTY_CODE, name: bootstrap.BOOTSTRAP_PROPERTY_NAME })
      .onConflictDoUpdate({ target: properties.code, set: { name: bootstrap.BOOTSTRAP_PROPERTY_NAME } }).returning({ id: properties.id });
    const roleRows = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, 'administrator')).limit(1);
    const propertyId = propertyRows[0]?.id;
    const roleId = roleRows[0]?.id;
    if (!propertyId || !roleId) throw new Error('Security migration has not been applied');
    const passwordHash = await crypto.hashPassword(bootstrap.BOOTSTRAP_ADMIN_PASSWORD);
    const created = await tx.insert(accounts).values({ propertyId, roleId, email: bootstrap.BOOTSTRAP_ADMIN_EMAIL, passwordHash, passwordChangeRequired: false })
      .onConflictDoNothing({ target: accounts.email }).returning({ id: accounts.id });
    if (created[0]) {
      await audit.record({ eventType: 'admin.account.created', subjectType: 'account', subjectId: created[0]!.id, propertyId, metadata: { source: 'bootstrap' } }, tx);
    } else {
      const existing = await tx.select({ propertyId: accounts.propertyId }).from(accounts).where(eq(accounts.email, bootstrap.BOOTSTRAP_ADMIN_EMAIL)).limit(1);
      if (existing[0]?.propertyId !== propertyId) throw new Error('Administrator email already belongs to another property');
    }
  });
} finally {
  await pool.end();
}
