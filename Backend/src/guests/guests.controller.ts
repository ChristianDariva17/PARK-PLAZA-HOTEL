import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseCreateGuestDto, parseGuestId, parseUpdateGuestDto } from './guests.dto.js';
import { GuestsService } from './guests.service.js';

@Controller('guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get()
  @RequirePermissions('guests.read')
  list(@CurrentAccount() account: AuthenticatedAccount) {
    return this.guests.list(account.propertyId);
  }

  @Post()
  @RequirePermissions('guests.create')
  create(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.guests.create(actor, parseCreateGuestDto(body), getRequestContext(request));
  }

  @Patch(':guestId')
  @RequirePermissions('guests.update')
  update(@Param('guestId') guestId: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.guests.update(actor, parseGuestId(guestId), parseUpdateGuestDto(body), getRequestContext(request));
  }
}
