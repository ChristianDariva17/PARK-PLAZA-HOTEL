import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  @Get('live')
  live() { return { status: 'ok' }; }

  @Get('ready')
  async ready() {
    try {
      const result = await this.database.execute<{ schema_ready: boolean }>(sql`select to_regclass('public.reservations') is not null as schema_ready`);
      if (!result.rows[0]?.schema_ready) throw new Error('Database schema is not migrated');
      return { status: 'ok', database: 'ready' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unavailable' });
    }
  }
}
