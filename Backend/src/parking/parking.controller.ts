import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { AuthenticatedAccount } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { parseArchiveParkingDto, parseCreateParkingDto, parseExitParkingDto, parseUpdateParkingDto } from './parking.dto.js';
import { ParkingService } from './parking.service.js';

@Controller('parking')
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Get()
  @RequirePermissions('parking.read')
  findAll(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.parkingService.findAll(actor.propertyId);
  }

  @Post()
  @RequirePermissions('parking.create')
  create(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.parkingService.create(actor.propertyId, parseCreateParkingDto(body));
  }

  @Patch(':id')
  @RequirePermissions('parking.update')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.parkingService.update(id, actor.propertyId, parseUpdateParkingDto(body));
  }

  @Post(':id/exit')
  @RequirePermissions('parking.exit')
  exit(@Param('id') id: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.parkingService.exit(id, actor.propertyId, parseExitParkingDto(body));
  }

  @Post(':id/archive')
  @RequirePermissions('parking.archive')
  archive(@Param('id') id: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.parkingService.archive(id, actor.propertyId, parseArchiveParkingDto(body).reason);
  }
}
