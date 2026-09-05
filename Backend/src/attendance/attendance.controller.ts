import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseReportManualAttendanceDto, parseSubmitCorrectionDto, parseApproveCorrectionDto, parseReportBiometricAttendanceDto, parseReportQrAttendanceDto } from './attendance.dto.js';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

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
