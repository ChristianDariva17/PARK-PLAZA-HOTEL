import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { InfrastructureModule } from '../infrastructure/infrastructure.module.js';
import { ObservabilityModule } from '../observability/observability.module.js';

@Global()
@Module({
  imports: [DatabaseModule, InfrastructureModule, ObservabilityModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
