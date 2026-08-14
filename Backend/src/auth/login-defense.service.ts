import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';
import type { Environment } from '../config/environment.js';
import { DATABASE_POOL } from '../database/database.module.js';
import type { Pool } from 'pg';
import { CryptoService } from './crypto.service.js';

type AttemptKind = 'ip' | 'account';
interface AttemptRow { failure_count: number; window_started_at: Date; blocked_until: Date | null }

@Injectable()
export class LoginDefenseService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly config: ConfigService<Environment, true>,
    private readonly crypto: CryptoService,
  ) {}

  async assertAllowed(ip: string, email: string): Promise<void> {
    const ipKey: [AttemptKind, string] = ['ip', this.crypto.hashLoginKey(ip)];
    const accountKey: [AttemptKind, string] = ['account', this.crypto.hashLoginKey(email)];
    const result = await this.pool.query<Pick<AttemptRow, 'blocked_until'>>(
      `select blocked_until from login_attempts where (kind, key_hash) in (($1, $2), ($3, $4)) and blocked_until > now() limit 1`,
      [...ipKey, ...accountKey],
    );
    if (result.rowCount) throw new UnauthorizedException('Invalid email or password');
  }

  async registerFailure(ip: string, email: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const ipFailures = await this.increment(client, 'ip', this.crypto.hashLoginKey(ip));
      const accountFailures = await this.increment(client, 'account', this.crypto.hashLoginKey(email));
      await client.query('commit');
      const exponent = Math.min(Math.max(ipFailures, accountFailures) - 1, 6);
      return Math.min(
        this.config.get('AUTH_LOGIN_BASE_DELAY_MS', { infer: true }) * (2 ** exponent),
        this.config.get('AUTH_LOGIN_MAX_DELAY_MS', { infer: true }),
      );
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }

  async clearAccount(email: string): Promise<void> {
    await this.pool.query(`delete from login_attempts where kind = 'account' and key_hash = $1`, [this.crypto.hashLoginKey(email)]);
  }

  private async increment(client: PoolClient, kind: AttemptKind, keyHash: string): Promise<number> {
    const now = new Date();
    await client.query(`insert into login_attempts (kind, key_hash) values ($1, $2) on conflict do nothing`, [kind, keyHash]);
    const locked = await client.query<AttemptRow>(`select failure_count, window_started_at, blocked_until from login_attempts where kind = $1 and key_hash = $2 for update`, [kind, keyHash]);
    const row = locked.rows[0];
    if (!row) throw new Error('Login defense row disappeared');
    const windowMs = this.config.get('AUTH_LOGIN_WINDOW_MINUTES', { infer: true }) * 60_000;
    const blockExpired = row.blocked_until !== null && row.blocked_until <= now;
    const resetWindow = blockExpired || now.getTime() - row.window_started_at.getTime() > windowMs;
    const count = resetWindow ? 1 : row.failure_count + 1;
    const blockedUntil = count >= this.config.get('AUTH_LOGIN_MAX_FAILURES', { infer: true })
      ? new Date(now.getTime() + this.config.get('AUTH_LOGIN_LOCK_MINUTES', { infer: true }) * 60_000)
      : null;
    await client.query(`update login_attempts set failure_count = $3, window_started_at = case when $4 then $5 else window_started_at end, blocked_until = $6, updated_at = $5 where kind = $1 and key_hash = $2`, [kind, keyHash, count, resetWindow, now, blockedUntil]);
    return count;
  }
}
