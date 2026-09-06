import { Body, Controller, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { BridgeCapabilityService } from './bridge-capability.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseBridgeCapabilityDto, parseReportManualAttendanceDto, parseSubmitCorrectionDto, parseApproveCorrectionDto, parseReportBiometricAttendanceDto, parseReportQrAttendanceDto } from './attendance.dto.js';

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly bridgeCapabilities: BridgeCapabilityService,
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
  async issueBiometricCapability(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    const request = parseBridgeCapabilityDto(body);
    if (request.operation === 'health') {
      if (!actor.permissions.some((permission) => ['guests.biometric', 'staff.biometric', 'staff.attendance'].includes(permission))) {
        throw new ForbiddenException('Insufficient permissions');
      }
      return this.bridgeCapabilities.issue('health');
    }

    const required = request.subjectType === 'client'
      ? ['guests.biometric']
      : request.operation === 'enroll'
        ? ['staff.biometric']
        : ['staff.biometric', 'staff.attendance'];
    if (!required.every((permission) => actor.permissions.includes(permission))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.bridgeCapabilities.issue(request.operation, { type: request.subjectType, id: request.subjectId });
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
