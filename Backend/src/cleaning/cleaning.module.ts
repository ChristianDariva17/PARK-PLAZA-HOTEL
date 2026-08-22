import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { CleaningController } from './cleaning.controller.js';
import { CleaningService } from './cleaning.service.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [CleaningController],
  providers: [CleaningService],
  exports: [CleaningService],
})
export class CleaningModule {}
