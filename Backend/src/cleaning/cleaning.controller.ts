import { Body, Controller, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import {
  parseCleaningTaskId,
  parseCreateCleaningTaskDto,
  parseCreateIncidentDto,
  parseIdempotencyKey,
  parseProgressCleaningTaskDto,
  parseUpdateCleaningTaskDto,
} from './cleaning.dto.js';
import { CleaningService } from './cleaning.service.js';

@Controller('cleaning')
export class CleaningController {
  constructor(private readonly cleaning: CleaningService) {}

  @Get()
  @RequirePermissions('cleaning.read')
  list(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.cleaning.list(actor.propertyId);
  }

  @Post()
  @RequirePermissions('cleaning.assign')
  create(
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cleaning.createTask(
      actor,
      parseCreateCleaningTaskDto(body),
      parseIdempotencyKey(key),
      getRequestContext(request),
    );
  }

  @Patch(':id')
  @RequirePermissions('cleaning.assign')
  update(

    @Param('id') taskId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cleaning.updateTask(
      actor,
      parseCleaningTaskId(taskId),
      parseUpdateCleaningTaskDto(body),
      parseIdempotencyKey(key),
      getRequestContext(request),
    );
  }

  @Post(':id/progress')
  @RequirePermissions('cleaning.progress')
  progress(
    @Param('id') taskId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cleaning.progressTask(
      actor,
      parseCleaningTaskId(taskId),
      parseProgressCleaningTaskDto(body),
      parseIdempotencyKey(key),
      getRequestContext(request),
    );
  }

  @Post(':id/incident')
  @RequirePermissions('cleaning.report_incident')
  reportIncident(

    @Param('id') taskId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cleaning.reportIncident(
      actor,
      parseCleaningTaskId(taskId),
      parseCreateIncidentDto(body),
      parseIdempotencyKey(key),
      getRequestContext(request),
    );
  }
}
