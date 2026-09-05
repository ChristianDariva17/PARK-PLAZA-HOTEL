import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { GeofenceService } from './geofence.service.js';
import { DynamicQrService } from './dynamic-qr.service.js';
import { StaffModule } from '../staff/staff.module.js';

@Module({
  imports: [DatabaseModule, AuditModule, StaffModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, GeofenceService, DynamicQrService],
  exports: [AttendanceService, GeofenceService, DynamicQrService],
})
export class AttendanceModule {}
