import { Controller, Get, Put, Body, BadRequestException, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SettingsService } from './settings.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import type { AuthenticatedAccount } from '../auth/auth.types.js';
import { z } from 'zod';

const settingsUpdateSchema = z.object({
  name: z.string().max(160).optional(),
  timezone: z.string().max(64).optional(),
  currency: z.string().length(3).optional(),
  dayUseStart: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).optional(),
  dayUseEnd: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).optional(),
  dayUseMinimumMinutes: z.number().int().positive().optional(),
  reservationIntervalMinutes: z.number().int().positive().optional(),
}).strict();

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions('settings.read')
  async getSettings(@CurrentAccount() actor: AuthenticatedAccount) {
    return this.settingsService.getSettings(actor.propertyId);
  }

  @Put()
  @RequirePermissions('settings.manage')
  async updateSettings(
    @CurrentAccount() actor: AuthenticatedAccount, 
    @Req() req: FastifyRequest,
    @Body() body: any
  ) {
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid settings update payload', { cause: parsed.error });
    }
    const context: { requestId?: string; ipAddress?: string; userAgent?: string } = {};
    if (req.id) context.requestId = req.id as string;
    if (req.ip) context.ipAddress = req.ip;
    if (req.headers['user-agent']) context.userAgent = req.headers['user-agent'];

    return this.settingsService.updateSettings(actor, parsed.data as any, context);
  }
}
