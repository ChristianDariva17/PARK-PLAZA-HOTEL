import { Body, Controller, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import {
  parseCreateIncidentDto,
  parseIdempotencyKey,
  parseIncidentId,
  parseProgressIncidentDto,
  parseUpdateIncidentDto,
} from './incidents.dto.js';
import { IncidentsService } from './incidents.service.js';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  @RequirePermissions('incidents.read')
  list(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.incidents.list(actor.propertyId);
  }

  @Post()
  @RequirePermissions('incidents.create')
  create(
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidents.create(actor, parseCreateIncidentDto(body), getRequestContext(request));
  }

  @Patch(':id')
  @RequirePermissions('incidents.update')
  update(
    @Param('id') incidentId: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidents.update(
      actor,
      parseIncidentId(incidentId),
      parseUpdateIncidentDto(body),
      getRequestContext(request),
    );
  }

  @Post(':id/progress')
  @RequirePermissions('incidents.progress')
  progress(
    @Param('id') incidentId: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidents.progress(
      actor,
      parseIncidentId(incidentId),
      parseProgressIncidentDto(body),
      getRequestContext(request),
    );
  }
}
