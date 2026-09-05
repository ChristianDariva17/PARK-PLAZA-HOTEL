import { Controller, Get, Post, Put, Body, Param, Query, Req } from '@nestjs/common';
import { ExperiencesService } from './experiences.service.js';
import { CreateExperienceDto, UpdateExperienceDto, CreateParticipationDto, ListExperiencesQueryDto } from './experiences.dto.js';

@Controller('properties/:propertyId/experiences')
export class ExperiencesController {
  constructor(private readonly experiencesService: ExperiencesService) {}

  @Post()
  async createExperience(
    @Param('propertyId') propertyId: string,
    @Req() req: any,
    @Body() dto: CreateExperienceDto
  ) {
    const accountId = req.account.id;
    return this.experiencesService.createExperience(propertyId, accountId, dto, {
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  @Get()
  async listExperiences(
    @Param('propertyId') propertyId: string,
    @Query() query: ListExperiencesQueryDto
  ) {
    return this.experiencesService.listExperiences(propertyId, query);
  }

  @Put(':experienceId')
  async updateExperience(
    @Param('propertyId') propertyId: string,
    @Param('experienceId') experienceId: string,
    @Req() req: any,
    @Body() dto: UpdateExperienceDto
  ) {
    const accountId = req.account.id;
    return this.experiencesService.updateExperience(propertyId, accountId, experienceId, dto, {
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  @Post(':experienceId/participations')
  async registerParticipation(
    @Param('propertyId') propertyId: string,
    @Param('experienceId') experienceId: string,
    @Req() req: any,
    @Body() dto: CreateParticipationDto
  ) {
    const accountId = req.account.id;
    return this.experiencesService.registerParticipation(propertyId, accountId, experienceId, dto, {
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  @Get(':experienceId/participations')
  async listParticipations(
    @Param('propertyId') propertyId: string,
    @Param('experienceId') experienceId: string
  ) {
    return this.experiencesService.listParticipations(propertyId, experienceId);
  }
}
