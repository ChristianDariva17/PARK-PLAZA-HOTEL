import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { FolioController } from './folio.controller.js';
import { FolioService } from './folio.service.js';
@Module({ imports: [DatabaseModule, AuditModule], controllers: [FolioController], providers: [FolioService], exports: [FolioService] })
export class FolioModule {}
