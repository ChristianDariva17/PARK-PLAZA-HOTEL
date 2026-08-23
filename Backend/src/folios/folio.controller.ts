import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseIdempotencyKey, parseStayId } from '../stays/stays.dto.js';
import { FolioService } from './folio.service.js';
import { parseFolioChargeDto, parseFolioEntryId, parseFolioPaymentDto, parseFolioReversalDto } from './folio.dto.js';

@Controller('stays/:stayId/folio')
export class FolioController {
  constructor(private readonly folios: FolioService) {}
  @Get() @RequirePermissions('stays.read') get(@Param('stayId') stayId: string, @CurrentAccount() actor: AuthenticatedAccount) { return this.folios.get(actor.propertyId, parseStayId(stayId)); }
  @Post('charges') @RequirePermissions('finance.charge') charge(@Param('stayId') stayId: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() req: AuthenticatedRequest) { return this.folios.charge(actor, parseStayId(stayId), parseFolioChargeDto(body), parseIdempotencyKey(key), getRequestContext(req)); }
  @Post('payments') @RequirePermissions('finance.payment') payment(@Param('stayId') stayId: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() req: AuthenticatedRequest) { return this.folios.payment(actor, parseStayId(stayId), parseFolioPaymentDto(body), parseIdempotencyKey(key), getRequestContext(req)); }
  @Post('entries/:entryId/reverse') @RequirePermissions('finance.reverse') reverse(@Param('stayId') stayId: string, @Param('entryId') entryId: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() req: AuthenticatedRequest) { return this.folios.reverse(actor, parseStayId(stayId), parseFolioEntryId(entryId), parseFolioReversalDto(body), parseIdempotencyKey(key), getRequestContext(req)); }
}
