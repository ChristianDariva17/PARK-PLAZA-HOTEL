import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseCheckInDto, parseCheckOutDto, parseIdempotencyKey, parseStayId, parseWalkInDto } from './stays.dto.js';
import { StaysService } from './stays.service.js';

@Controller('stays')
export class StaysController {
  constructor(private readonly stays: StaysService) {}

  @Get() @RequirePermissions('stays.read')
  list(@CurrentAccount() actor: AuthenticatedAccount) { return this.stays.list(actor.propertyId); }

  @Post('reservation/:id/check-in') @RequirePermissions('stays.check_in')
  checkIn(@Param('id') reservationId: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.stays.checkIn(actor, reservationId, parseCheckInDto(body), parseIdempotencyKey(key), getRequestContext(request));
  }

  @Post('walk-in') @RequirePermissions('stays.check_in')
  walkIn(@Body() body: unknown, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.stays.walkIn(actor, parseWalkInDto(body), parseIdempotencyKey(key), getRequestContext(request));
  }

  @Post(':id/check-out') @RequirePermissions('stays.check_out')
  checkOut(@Param('id') stayId: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.stays.checkOut(actor, parseStayId(stayId), parseCheckOutDto(body ?? {}), parseIdempotencyKey(key), getRequestContext(request));
  }


  @Post('rooms/:id/cleaning-complete') @RequirePermissions('cleaning.progress')
  cleaningComplete(@Param('id') roomId: string, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.stays.cleaningComplete(actor, roomId, parseIdempotencyKey(key), getRequestContext(request));
  }
}
