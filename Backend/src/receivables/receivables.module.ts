import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { FolioModule } from '../folios/folio.module.js';
import { ReceivablesController } from './receivables.controller.js';
import { ReceivablesService } from './receivables.service.js';
@Module({ imports: [DatabaseModule, AuditModule, FolioModule], controllers: [ReceivablesController], providers: [ReceivablesService] })
export class ReceivablesModule {}
