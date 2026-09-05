import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
