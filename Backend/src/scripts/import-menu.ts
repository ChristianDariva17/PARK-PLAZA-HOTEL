import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { databaseUrlFromEnv, validateEnv } from '../config/environment.js';
import * as schema from '../database/schema/index.js';
import { MenuImportService } from '../restaurant/menu-import.service.js';

const bootstrapSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  BOOTSTRAP_PROPERTY_CODE: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
});

const env = validateEnv(process.env);
const bootstrap = bootstrapSchema.parse(process.env);

const pool = new Pool({ connectionString: databaseUrlFromEnv(env), ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false, max: 10 });
const database = drizzle(pool, { schema });
const audit = new AuditService(database);
const menuImportService = new MenuImportService(database, audit);

try {
  // Find the property
  const [property] = await database.select().from(schema.properties).where(eq(schema.properties.code, bootstrap.BOOTSTRAP_PROPERTY_CODE)).limit(1);
  if (!property) throw new Error('Property not found. Run migrations and bootstrap first.');

  // Find the admin account
  const [adminAccount] = await database.select().from(schema.accounts).where(eq(schema.accounts.email, bootstrap.BOOTSTRAP_ADMIN_EMAIL)).limit(1);
  if (!adminAccount) throw new Error('Admin account not found. Run bootstrap first.');

  const markdownPath = path.resolve(process.cwd(), '../menu_park_plaza.md');
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`Menu file not found at ${markdownPath}`);
  }

  const markdown = fs.readFileSync(markdownPath, 'utf8');

  console.log(`Starting menu import for property ${property.code}...`);
  const result = await menuImportService.apply(
    { 
      accountId: adminAccount.id, 
      email: adminAccount.email, 
      propertyId: adminAccount.propertyId, 
      roleKey: 'administrator',
      permissions: [],
      sessionId: 'bootstrap-script-session',
      passwordChangeRequired: false
    },
    markdown,
    { ipAddress: '127.0.0.1', userAgent: 'bootstrap-script' }
  );

  console.log('Menu import completed successfully!');
  console.log('Run ID:', result.runId);
  console.log('Categories:', result.categories);
  console.log('Items:', result.items);
  console.log('Variants:', result.variants);
} catch (error) {
  console.error('Failed to import menu:', error);
  process.exit(1);
} finally {
  await pool.end();
}
