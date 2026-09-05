import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { getRequestContext } from '../auth/request-context.js';
import {
  parseArchiveStaffDto,
  parseCreateStaffDto,
  parseReactivateStaffDto,
  parseUpdateStaffDto,
  parseCreateWorkScheduleDto,
  parseAssignWorkScheduleDto
} from './staff.dto.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @RequirePermissions('staff.read')
  async listStaff(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.staffService.listStaff(actor.propertyId);
  }

  @Get(':id')
  @RequirePermissions('staff.read')
  async getStaff(@Param('id') id: string, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.staffService.getStaff(id, actor.propertyId);
  }

  @Post()
  @RequirePermissions('staff.create')
  async createStaff(
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest
  ) {
    const payload = parseCreateStaffDto(body);
    const reqContext = getRequestContext(req);
    return this.staffService.createStaff(actor.propertyId, payload, reqContext);
  }

  @Patch(':id')
  @RequirePermissions('staff.update')
  async updateStaff(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest
  ) {
    const payload = parseUpdateStaffDto(body);
    const reqContext = getRequestContext(req);
    return this.staffService.updateStaff(id, actor.propertyId, payload, reqContext);
  }

  @Post(':id/archive')
  @RequirePermissions('staff.archive')
  async archiveStaff(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() req: AuthenticatedRequest
  ) {
    const payload = parseArchiveStaffDto(body);
    const reqContext = getRequestContext(req);
    return this.staffService.archiveStaff(id, actor.propertyId, payload, reqContext);
  }

  @Post(':id/reactivate')
  @RequirePermissions('staff.archive')
  async reactivateStaff(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest
  ) {
    return this.staffService.reactivateStaff(
      id,
      actor.propertyId,
      parseReactivateStaffDto(body),
      getRequestContext(request)
    );
  }

  @Post('work-schedules')
  @RequirePermissions('staff.shifts')
  async createWorkSchedule(
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest
  ) {
    return this.staffService.createWorkSchedule(
      actor.propertyId,
      parseCreateWorkScheduleDto(body),
      getRequestContext(request)
    );
  }

  @Get('work-schedules')
  @RequirePermissions('staff.shifts')
  async listWorkSchedules(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.staffService.listWorkSchedules(actor.propertyId);
  }

  @Post(':id/work-schedule-assignments')
  @RequirePermissions('staff.shifts')
  async assignWorkSchedule(
    @Param('id') staffId: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest
  ) {
    return this.staffService.assignWorkSchedule(
      staffId,
      actor.propertyId,
      parseAssignWorkScheduleDto(body),
      getRequestContext(request)
    );
  }
}
