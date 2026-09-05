import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import {
  parseCloseCashSessionDto,
  parseCountCashSessionDto,
  parseCreateCashMovementDto,
  parseIdempotencyKey,
  parseOpenCashSessionDto,
  parseSessionId,
} from './cash.dto.js';
import { CashService } from './cash.service.js';

@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('session/active')
  @RequirePermissions('cash.read')
  getActiveSession(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.cash.getActiveSession(actor.propertyId);
  }

  @Get('sessions')
  @RequirePermissions('cash.read')
  listSessions(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.cash.listSessions(actor.propertyId);
  }

  @Get('movements/:sessionId')
  @RequirePermissions('cash.read')
  listMovements(
    @Param('sessionId') sessionId: string,
    @CurrentAccount() actor: AuthenticatedAccount,
  ) {
    return this.cash.listMovements(actor.propertyId, parseSessionId(sessionId));
  }

  @Get('session/:sessionId/counts')
  @RequirePermissions('cash.read')
  listCounts(@Param('sessionId') sessionId: string, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.cash.listCounts(actor.propertyId, parseSessionId(sessionId));
  }

  @Post('session/open')
  @RequirePermissions('cash.open')
  openSession(
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cash.openSession(actor, parseOpenCashSessionDto(body), parseIdempotencyKey(key), getRequestContext(request));
  }

  @Post('session/count/:id')
  @RequirePermissions('cash.count')
  countSession(
    @Param('id') sessionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cash.countSession(
      actor,
      parseSessionId(sessionId),
      parseCountCashSessionDto(body),
      parseIdempotencyKey(key),
      getRequestContext(request),
    );
  }

  @Post('session/close/:id')
  @RequirePermissions('cash.close')
  closeSession(
    @Param('id') sessionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cash.closeSession(
      actor,
      parseSessionId(sessionId),
      parseCloseCashSessionDto(body),
      parseIdempotencyKey(key),
      getRequestContext(request),
    );
  }

  @Post('movements')
  @RequirePermissions('cash.move')
  createMovement(
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cash.createMovement(
      actor,
      parseCreateCashMovementDto(body),
      parseIdempotencyKey(key),
      getRequestContext(request),
    );
  }
}
