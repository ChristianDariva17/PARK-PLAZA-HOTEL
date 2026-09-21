import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { FolioModule } from '../folios/folio.module.js';
import { StaysController } from './stays.controller.js';
import { StaysService } from './stays.service.js';

@Module({ imports: [AuthModule, FolioModule, AuditModule], controllers: [StaysController], providers: [StaysService] })
export class StaysModule {}
