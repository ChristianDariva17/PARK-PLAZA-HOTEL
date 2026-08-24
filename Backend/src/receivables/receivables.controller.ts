import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseIdempotencyKey } from '../stays/stays.dto.js';
import { parseCollectionDto, parseListFilters, parseReceivableEntryId, parseReceivableId, parseReversalDto } from './receivables.dto.js';
import { ReceivablesService } from './receivables.service.js';

@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivables: ReceivablesService) {}
  @Get() @RequirePermissions('finance.read') list(@Query() query: unknown, @CurrentAccount() actor: AuthenticatedAccount) { const filters = parseListFilters(query); return this.receivables.list(actor.propertyId, { ...(filters.status ? { status: filters.status } : {}), ...(filters.age ? { age: filters.age } : {}) }); }
  @Get(':id') @RequirePermissions('finance.read') detail(@Param('id') id: string, @CurrentAccount() actor: AuthenticatedAccount) { return this.receivables.detail(actor.propertyId, parseReceivableId(id)); }
  @Post(':id/collections') @RequirePermissions('finance.payment') collect(@Param('id') id: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() req: AuthenticatedRequest) { return this.receivables.collect(actor, parseReceivableId(id), parseCollectionDto(body), parseIdempotencyKey(key), getRequestContext(req)); }
  @Post(':id/collections/:entryId/reverse') @RequirePermissions('finance.reverse') reverse(@Param('id') id: string, @Param('entryId') entryId: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() req: AuthenticatedRequest) { return this.receivables.reverse(actor, parseReceivableId(id), parseReceivableEntryId(entryId), parseReversalDto(body), parseIdempotencyKey(key), getRequestContext(req)); }
}
