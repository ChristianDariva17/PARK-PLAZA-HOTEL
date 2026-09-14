import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AttendanceService } from './attendance.service.js';
import { BridgeCapabilityService } from './bridge-capability.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { getRequestContext } from '../auth/request-context.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { guests, staff } from '../database/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { parseBridgeCapabilityDto, parseReportManualAttendanceDto, parseSubmitCorrectionDto, parseApproveCorrectionDto, parseReportBiometricAttendanceDto, parseReportQrAttendanceDto } from './attendance.dto.js';

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly bridgeCapabilities: BridgeCapabilityService,
    @Inject(DATABASE) private readonly database: Database,
  ) {}

  @Get('events')
  @RequirePermissions('staff.attendance.read')
  async listEvents(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.attendanceService.listEvents(actor.propertyId);
  }

  @Get('kiosk-qr')
  @RequirePermissions('staff.attendance.read')
  async getKioskQr(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.attendanceService.getKioskQrToken(actor.propertyId);
  }

  @Post('scan-qr')
  @RequirePermissions('staff.attendance.manual')
  async reportQrAttendance(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.attendanceService.reportQrAttendance(
      actor,
      parseReportQrAttendanceDto(body),
      getRequestContext(request)
    );
  }

  @Post('manual')
  @RequirePermissions('staff.attendance.manual')
  async reportManualAttendance(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.attendanceService.reportManualAttendance(
      actor,
      parseReportManualAttendanceDto(body),
      getRequestContext(request)
    );
  }

  @Post('biometric')
  @RequirePermissions('staff.attendance')
  async reportBiometricAttendance(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.attendanceService.reportBiometricAttendance(
      actor,
      parseReportBiometricAttendanceDto(body),
      getRequestContext(request)
    );
  }

  @Post('biometric/capability')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async issueBiometricCapability(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    const request = parseBridgeCapabilityDto(body);
    if (request.operation === 'health') {
      if (!actor.permissions.some((permission) => ['guests.biometric', 'staff.biometric', 'staff.attendance'].includes(permission))) {
        throw new ForbiddenException('Insufficient permissions');
      }
      return this.bridgeCapabilities.issue('health', undefined, actor.propertyId);
    }

    const required = request.subjectType === 'client'
      ? ['guests.biometric']
      : request.operation === 'enroll'
        ? ['staff.biometric']
        : ['staff.biometric', 'staff.attendance'];
    if (!required.every((permission) => actor.permissions.includes(permission))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const subjectTable = request.subjectType === 'employee' ? staff : guests;
    const [subject] = await this.database.select({ id: subjectTable.id })
      .from(subjectTable)
      .where(and(eq(subjectTable.id, request.subjectId), eq(subjectTable.propertyId, actor.propertyId)))
      .limit(1);
    if (!subject) throw new NotFoundException('Sujeto biométrico no encontrado');
    return this.bridgeCapabilities.issue(request.operation, { type: request.subjectType, id: request.subjectId }, actor.propertyId);
  }

  @Post('corrections')
  @RequirePermissions('staff.attendance.correct')
  async submitCorrection(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.attendanceService.submitCorrection(
      actor,
      parseSubmitCorrectionDto(body),
      getRequestContext(request)
    );
  }

  @Post('corrections/:id/decide')
  @RequirePermissions('staff.attendance.approve')
  async decideCorrection(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attendanceService.decideCorrection(
      id,
      actor,
      parseApproveCorrectionDto(body),
      getRequestContext(request)
    );
  }
}
