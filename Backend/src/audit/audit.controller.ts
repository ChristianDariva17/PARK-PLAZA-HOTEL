import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import type { AuthenticatedAccount } from '../auth/auth.types.js';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  async listAuditEvents(
    @CurrentAccount() actor: AuthenticatedAccount,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid limit parameter, must be between 1 and 100');
    }
    if (isNaN(offset) || offset < 0) {
      throw new BadRequestException('Invalid offset parameter, must be non-negative');
    }

    const events = await this.auditService.listEvents(actor.propertyId, limit, offset);
    return { events, limit, offset };
  }
}
