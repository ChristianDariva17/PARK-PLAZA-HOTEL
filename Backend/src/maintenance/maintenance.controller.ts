import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import {
  parseCreateMaintenanceDto,
  parseMaintenanceId,
  parseProgressMaintenanceDto,
  parseUpdateMaintenanceDto,
} from './maintenance.dto.js';
import { MaintenanceService } from './maintenance.service.js';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @RequirePermissions('maintenance.read')
  list(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.maintenance.list(actor.propertyId);
  }

  @Post()
  @RequirePermissions('maintenance.create')
  create(
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.maintenance.create(actor, parseCreateMaintenanceDto(body), getRequestContext(request));
  }

  @Patch(':id')
  @RequirePermissions('maintenance.update')
  update(
    @Param('id') ticketId: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.maintenance.update(
      actor,
      parseMaintenanceId(ticketId),
      parseUpdateMaintenanceDto(body),
      getRequestContext(request),
    );
  }

  @Post(':id/progress')
  @RequirePermissions('maintenance.progress')
  progress(
    @Param('id') ticketId: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.maintenance.progress(
      actor,
      parseMaintenanceId(ticketId),
      parseProgressMaintenanceDto(body),
      getRequestContext(request),
    );
  }
}
