import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { getRequestContext } from '../auth/request-context.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { parseCreatePetDto, parseTransitionPetDto, parseUpdatePetDto } from './pets.dto.js';
import { PetsService } from './pets.service.js';

@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  @RequirePermissions('pets.read')
  findAll(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.petsService.findAll(actor.propertyId);
  }

  @Post()
  @RequirePermissions('pets.create')
  create(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.petsService.create(actor, parseCreatePetDto(body), getRequestContext(request));
  }

  @Patch(':id')
  @RequirePermissions('pets.update')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.petsService.update(id, actor.propertyId, parseUpdatePetDto(body));
  }

  @Post(':id/archive')
  @RequirePermissions('pets.archive')
  archive(@Param('id') id: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.petsService.archive(id, actor.propertyId, parseTransitionPetDto(body).reason);
  }

  @Post(':id/reactivate')
  @RequirePermissions('pets.archive')
  reactivate(@Param('id') id: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount) {
    return this.petsService.reactivate(id, actor.propertyId, parseTransitionPetDto(body).reason);
  }
}
