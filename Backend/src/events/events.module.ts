import { Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { EventsIdentityMigrationService } from './events-identity-migration.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { FolioModule } from '../folios/folio.module.js';

@Module({
  imports: [DatabaseModule, AuditModule, FolioModule],
  controllers: [EventsController],
  providers: [EventsService, EventsIdentityMigrationService],
  exports: [EventsService, EventsIdentityMigrationService],
})
export class EventsModule {}
