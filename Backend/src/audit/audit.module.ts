import { Global, Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { AuditService } from './audit.service.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  imports: [RealtimeModule],
  providers: [OutboxService, AuditService],
  exports: [AuditService, OutboxService],
})
export class AuditModule {}
