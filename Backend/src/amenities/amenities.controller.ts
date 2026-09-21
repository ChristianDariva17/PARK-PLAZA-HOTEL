import { Body, Controller, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { getRequestContext } from '../auth/request-context.js';
import { AmenitiesService } from './amenities.service.js';
import {
  CreateAmenityBlockDto,
  CreateManualAmenityPassDto,
  UpdateAmenityConfigDto,
} from './amenities.dto.js';

@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get('config')
  @RequirePermissions('amenities.read')
  async getConfigs(@CurrentAccount() account: AuthenticatedAccount) {
    return this.amenitiesService.getConfigs(account.propertyId);
  }

  @Put('config')
  @RequirePermissions('amenities.config')
  async updateConfig(
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateAmenityConfigDto,
  ) {
    return this.amenitiesService.updateConfig(account, body, getRequestContext(request));
  }

  @Get('occupancy')
  @RequirePermissions('amenities.read')
  async getOccupancy(@CurrentAccount() account: AuthenticatedAccount) {
    return this.amenitiesService.getOccupancy(account.propertyId);
  }

  @Get('blocks')
  @RequirePermissions('amenities.read')
  async listBlocks(@CurrentAccount() account: AuthenticatedAccount) {
    return this.amenitiesService.listBlocks(account.propertyId);
  }

  @Post('blocks')
  @RequirePermissions('amenities.block')
  async createBlock(
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateAmenityBlockDto,
  ) {
    return this.amenitiesService.createBlock(account, body, getRequestContext(request));
  }

  @Get('reservations')
  @RequirePermissions('amenities.read')
  async listReservations(@CurrentAccount() account: AuthenticatedAccount) {
    return this.amenitiesService.listPropertyReservations(account.propertyId);
  }

  @Post('reservations/manual')
  @RequirePermissions('amenities.create', 'cash.move')
  async createManualPass(
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateManualAmenityPassDto,
  ) {
    return this.amenitiesService.createManualPass(account, body, getRequestContext(request));
  }

  @Get('reservations/:id/tab')
  @RequirePermissions('amenities.read')
  async getReservationTab(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    return this.amenitiesService.getReservationTab(account.propertyId, id);
  }

  @Post('reservations/:id/checkin')
  @RequirePermissions('amenities.checkin')
  async checkInReservation(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.amenitiesService.checkInReservation(account, id, getRequestContext(request));
  }

  @Patch('reservations/:id/identity')
  @RequirePermissions('amenities.identity')
  async updateReservationIdentity(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: { documentNumber?: string; customerName?: string },
  ) {
    return this.amenitiesService.updateReservationIdentity(account, id, body);
  }

  @Post('reservations/:id/settle')
  @RequirePermissions('amenities.settle', 'cash.move')
  async settleReservation(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: { paymentMethod: string; amount?: number; note?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.amenitiesService.settleReservation(account, id, body, getRequestContext(request));
  }
}
