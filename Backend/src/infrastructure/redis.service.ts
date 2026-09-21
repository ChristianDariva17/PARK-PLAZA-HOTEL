import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { Environment } from '../config/environment.js';
import { resolveTlsCa } from '../config/tls-material.js';
import { safeErrorFields } from '../observability/safe-error.js';

type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private commandClient?: RedisClient;
  private pubClient?: RedisClient;
  private subClient?: RedisClient;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async connect(): Promise<void> {
    if (this.config.get('API_REPLICA_MODE', { infer: true }) !== 'shared') return;
    if (this.commandClient?.isReady && this.pubClient?.isReady && this.subClient?.isReady) return;

    const url = this.config.get('REDIS_URL', { infer: true });
    if (!url) throw new Error('REDIS_URL is required when API_REPLICA_MODE=shared');

    this.commandClient = this.createClient(url, 'command');
    this.pubClient = this.createClient(url, 'pub');
    this.subClient = this.createClient(url, 'sub');
    await Promise.all([
      this.commandClient.connect(),
      this.pubClient.connect(),
      this.subClient.connect(),
    ]);
    this.logger.log('Redis shared infrastructure connected');
  }

  isEnabled(): boolean {
    return this.commandClient !== undefined;
  }

  getCommandClient(): RedisClient {
    if (!this.commandClient) throw new Error('Redis shared infrastructure is not enabled');
    return this.commandClient;
  }

  getPubSubClients(): { pubClient: RedisClient; subClient: RedisClient } {
    if (!this.pubClient || !this.subClient) throw new Error('Redis shared infrastructure is not enabled');
    return { pubClient: this.pubClient, subClient: this.subClient };
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.close(this.commandClient), this.close(this.pubClient), this.close(this.subClient)]);
  }

  private createClient(url: string, name: string): RedisClient {
    const tls = this.config.get('REDIS_TLS', { infer: true });
    const ca = resolveTlsCa(
      this.config.get('REDIS_TLS_CA', { infer: true }),
      this.config.get('REDIS_TLS_CA_FILE', { infer: true }),
    );
    return createClient({
      url,
      socket: {
        tls,
        ...(ca ? { ca } : {}),
      },
    }).on('error', (error) => {
      this.logger.error(JSON.stringify({ event: 'redis.client_error', client: name, ...safeErrorFields(error) }));
    });
  }

  private async close(client?: RedisClient): Promise<void> {
    if (client?.isOpen) await client.disconnect();
  }
}
