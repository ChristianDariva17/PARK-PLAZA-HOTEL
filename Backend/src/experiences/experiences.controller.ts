import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ExperiencesService } from './experiences.service.js';
import { CreateExperienceDto, UpdateExperienceDto, CreateParticipationDto, ListExperiencesQueryDto } from './experiences.dto.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { getRequestContext } from '../auth/request-context.js';

@Controller('properties/:propertyId/experiences')
export class ExperiencesController {
  constructor(private readonly experiencesService: ExperiencesService) {}

  @Post()
  @RequirePermissions('experiences.create')
  async createExperience(
    @Param('propertyId') propertyId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateExperienceDto
  ) {
    const scopedPropertyId = this.scopedPropertyId(propertyId, account);
    return this.experiencesService.createExperience(scopedPropertyId, account.accountId, dto, getRequestContext(request));
  }

  @Get()
  @RequirePermissions('experiences.read')
  async listExperiences(
    @Param('propertyId') propertyId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListExperiencesQueryDto
  ) {
    return this.experiencesService.listExperiences(this.scopedPropertyId(propertyId, account), query);
  }

  @Put(':experienceId')
  @RequirePermissions('experiences.update')
  async updateExperience(
    @Param('propertyId') propertyId: string,
    @Param('experienceId') experienceId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateExperienceDto
  ) {
    const scopedPropertyId = this.scopedPropertyId(propertyId, account);
    return this.experiencesService.updateExperience(scopedPropertyId, account.accountId, experienceId, dto, getRequestContext(request));
  }

  @Post(':experienceId/participations')
  @RequirePermissions('experiences.participate')
  async registerParticipation(
    @Param('propertyId') propertyId: string,
    @Param('experienceId') experienceId: string,
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateParticipationDto
  ) {
    const scopedPropertyId = this.scopedPropertyId(propertyId, account);
    return this.experiencesService.registerParticipation(scopedPropertyId, account.accountId, experienceId, dto, getRequestContext(request));
  }

  @Get(':experienceId/participations')
  @RequirePermissions('experiences.read')
  async listParticipations(
    @Param('propertyId') propertyId: string,
    @Param('experienceId') experienceId: string,
    @CurrentAccount() account: AuthenticatedAccount
  ) {
    return this.experiencesService.listParticipations(this.scopedPropertyId(propertyId, account), experienceId);
  }

  private scopedPropertyId(propertyId: string, account: AuthenticatedAccount): string {
    if (propertyId !== account.propertyId) {
      throw new ForbiddenException('La propiedad solicitada no corresponde a la sesión activa');
    }
    return propertyId;
  }
}
