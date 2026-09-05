import { Controller, Get, Post, Patch, Put, Body, Param, Query, Req } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { EventsIdentityMigrationService } from './events-identity-migration.service.js';
import { createEventDto, updateEventDto, listEventsDto, eventCommandDto, cancelEventDto, confirmEventDto, quoteEventDto, replaceSpaceServicesDto, resolveIdentityDto, updateSpacePolicyDto, checkAvailabilityDto } from './events.dto.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { getRequestContext } from '../auth/request-context.js';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly migrationService: EventsIdentityMigrationService,
  ) {}

  @Get('quarantine/inventory')
  @RequirePermissions('events.update')
  async getQuarantineInventory(@CurrentAccount() account: AuthenticatedAccount) {
    return this.migrationService.getQuarantineInventory(account.propertyId);
  }

  @Post('quarantine/:id/resolve')
  @RequirePermissions('events.update')
  async resolveQuarantineIdentity(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsedBody = resolveIdentityDto.parse(body);
    return this.migrationService.resolveIdentity(
      { accountId: account.accountId, propertyId: account.propertyId },
      id,
      parsedBody.resolutionType as any,
      parsedBody.selectedId
    );
  }

  @Get()
  @RequirePermissions('events.read')
  async listEvents(@CurrentAccount() account: AuthenticatedAccount, @Query() query: any) {
    const parsedQuery = listEventsDto.parse(query);
    return this.eventsService.listEvents(account.propertyId, parsedQuery as any);
  }

  @Get('spaces')
  @RequirePermissions('events.read')
  async getSpaces(@CurrentAccount() account: AuthenticatedAccount) {
    return this.eventsService.getSpaces(account.propertyId);
  }

  @Get('spaces/:id/availability')
  @RequirePermissions('events.read')
  async checkSpaceAvailability(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Query() query: any,
  ) {
    const parsed = checkAvailabilityDto.parse(query);
    return this.eventsService.checkSpaceAvailability(
      account.propertyId,
      id,
      parsed.from,
      parsed.to,
      parsed.excludeEventId,
    );
  }

  @Get('spaces/:id/policy')
  @RequirePermissions('events.read')
  async getSpacePolicy(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string) {
    return this.eventsService.getSpacePolicy(account.propertyId, id);
  }

  @Patch('spaces/:id/policy')
  @RequirePermissions('events.update')
  async updateSpacePolicy(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string, @Body() body: unknown) {
    return this.eventsService.updateSpacePolicy(account.propertyId, id, updateSpacePolicyDto.parse(body));
  }

  @Put('spaces/:id/services')
  @RequirePermissions('events.update')
  async replaceSpaceServices(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string, @Body() body: unknown) {
    return this.eventsService.replaceSpaceServices(account.propertyId, id, replaceSpaceServicesDto.parse(body));
  }

  @Post('quote')
  @RequirePermissions('events.create')
  async quote(@CurrentAccount() account: AuthenticatedAccount, @Body() body: unknown) {
    return this.eventsService.quote(account.propertyId, quoteEventDto.parse(body));
  }

  @Get(':id')
  @RequirePermissions('events.read')
  async getEvent(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string) {
    return this.eventsService.getEvent(account.propertyId, id);
  }

  @Post()
  @RequirePermissions('events.create')
  async createEvent(@CurrentAccount() account: AuthenticatedAccount, @Body() body: any) {
    const parsedBody = createEventDto.parse(body);
    return this.eventsService.createEvent(account.propertyId, account.accountId, parsedBody);
  }

  @Patch(':id')
  @RequirePermissions('events.update')
  async updateEvent(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsedBody = updateEventDto.parse(body);
    return this.eventsService.updateEvent(account.propertyId, id, account.accountId, parsedBody);
  }

  @Post(':id/confirm')
  @RequirePermissions('events.confirm')
  async confirmEvent(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsedBody = confirmEventDto.parse(body);
    return this.eventsService.confirmEvent(account.propertyId, id, account.accountId, parsedBody);
  }

  @Post(':id/cancel')
  @RequirePermissions('events.cancel')
  async cancelEvent(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsedBody = cancelEventDto.parse(body);
    return this.eventsService.cancelEvent(account.propertyId, id, account.accountId, parsedBody);
  }

  @Post(':id/preparing')
  @RequirePermissions('events.update')
  async preparing(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string, @Body() body: unknown) {
    return this.eventsService.advanceEvent(account.propertyId, id, account.accountId, 'preparing', eventCommandDto.parse(body));
  }

  @Post(':id/start')
  @RequirePermissions('events.update')
  async start(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string, @Body() body: unknown) {
    return this.eventsService.advanceEvent(account.propertyId, id, account.accountId, 'in_progress', eventCommandDto.parse(body));
  }

  @Post(':id/complete')
  @RequirePermissions('events.update')
  async complete(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string, @Body() body: unknown) {
    return this.eventsService.advanceEvent(account.propertyId, id, account.accountId, 'completed', eventCommandDto.parse(body));
  }

  @Post(':id/archive')
  @RequirePermissions('events.archive')
  async archiveEvent(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsedBody = eventCommandDto.parse(body);
    return this.eventsService.archiveEvent(account.propertyId, id, account.accountId, parsedBody);
  }
}
