import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseAvailabilityQuery, parseCreateReservationDto } from './reservations.dto.js';
import { ReservationsService } from './reservations.service.js';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  @RequirePermissions('reservations.read')
  list(@CurrentAccount() account: AuthenticatedAccount) {
    return this.reservations.list(account.propertyId);
  }

  @Get('availability')
  @RequirePermissions('reservations.create')
  availability(@Query() query: unknown, @CurrentAccount() account: AuthenticatedAccount) {
    return this.reservations.availability(account.propertyId, parseAvailabilityQuery(query));
  }

  @Post()
  @RequirePermissions('reservations.create')
  create(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.reservations.create(actor, parseCreateReservationDto(body), getRequestContext(request));
  }
}
