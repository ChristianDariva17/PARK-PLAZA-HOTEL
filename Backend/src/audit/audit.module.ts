import { Global, Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { OutboxController } from './outbox.controller.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  imports: [RealtimeModule],
  controllers: [AuditController, OutboxController],
  providers: [OutboxService, AuditService],
  exports: [AuditService, OutboxService],
})
export class AuditModule {}
