import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { CommunicationsService } from './communications.service.js';
import { UpdatePreferenceDto, MarkNotificationReadDto, ListNotificationsQueryDto } from './communications.dto.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';

@Controller('properties/:propertyId/communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Put('preferences')
  async updatePreference(
    @Param('propertyId') propertyId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() dto: UpdatePreferenceDto
  ) {
    return this.communicationsService.updatePreference(this.propertyId(propertyId, account), account.accountId, dto, {});
  }

  @Get('preferences')
  async listPreferences(
    @Param('propertyId') propertyId: string,
    @CurrentAccount() account: AuthenticatedAccount
  ) {
    return this.communicationsService.listPreferences(this.propertyId(propertyId, account), account.accountId);
  }

  @Get('notifications')
  @RequirePermissions('notifications.read')
  async listNotifications(
    @Param('propertyId') propertyId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListNotificationsQueryDto
  ) {
    return this.communicationsService.listNotifications(this.propertyId(propertyId, account), account.accountId, account.roleKey, query);
  }

  @Post('notifications/read-all')
  @RequirePermissions('notifications.update')
  async markAllNotificationsRead(
    @Param('propertyId') propertyId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.communicationsService.markAllNotificationsRead(
      this.propertyId(propertyId, account),
      account.accountId,
      account.roleKey,
      getRequestContext(request)
    );
  }

  @Delete('notifications/clear-read')
  @RequirePermissions('notifications.update')
  async clearReadNotifications(
    @Param('propertyId') propertyId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.communicationsService.clearReadNotifications(
      this.propertyId(propertyId, account),
      account.accountId,
      account.roleKey,
      getRequestContext(request)
    );
  }

  @Post('notifications/clear-read')
  @RequirePermissions('notifications.update')
  async clearReadNotificationsPost(
    @Param('propertyId') propertyId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.communicationsService.clearReadNotifications(
      this.propertyId(propertyId, account),
      account.accountId,
      account.roleKey,
      getRequestContext(request)
    );
  }

  @Post('notifications/:notificationId/read')
  @RequirePermissions('notifications.update')
  async markNotificationRead(
    @Param('propertyId') propertyId: string,
    @Param('notificationId') notificationId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() dto: MarkNotificationReadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.communicationsService.markNotificationRead(
      this.propertyId(propertyId, account),
      account.accountId,
      account.roleKey,
      notificationId,
      dto.isRead,
      getRequestContext(request)
    );
  }

  private propertyId(propertyId: string, account: AuthenticatedAccount) {
    if (propertyId !== account.propertyId) throw new ForbiddenException('La propiedad solicitada no corresponde a la sesión activa');
    return propertyId;
  }
}
