import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { Environment } from '../config/environment.js';

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get('live')
  live() { return { status: 'ok' }; }

  @Get('ready')
  async ready() {
    try {
      const result = await this.database.execute<{
        reservations_ready: boolean;
        sentinel_ready: boolean;
        schema_version: string | null;
      }>(sql`
        select
          to_regclass('public.reservations') is not null as reservations_ready,
          to_regclass('public.schema_sentinels') is not null as sentinel_ready,
          (select version from public.schema_sentinels where key = 'application_schema') as schema_version
      `);
      const row = result.rows[0];
      const expectedVersion = this.config.get('DATABASE_SCHEMA_VERSION', { infer: true });
      if (!row?.reservations_ready || !row.sentinel_ready || row.schema_version !== expectedVersion) {
        throw new Error('Database schema is not at the required version');
      }
      return { status: 'ok', database: 'ready', schemaVersion: row.schema_version };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unavailable' });
    }
  }
}
