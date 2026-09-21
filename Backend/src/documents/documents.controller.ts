import { Controller, Get, Post, Body, Param, Query, Req, ForbiddenException, Headers } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { AuthenticatedAccount } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { FastifyRequest } from 'fastify';
import { 
  CreateContractDto, 
  ListContractsQueryDto,
  TransitionContractDto,
  LinkEvidenceDto,
  RegisterEvidenceDto,
  ListEvidenceQueryDto,
  ListAuditEventsQueryDto
} from './documents.dto.js';
import { parseIdempotencyKey } from '../stays/stays.dto.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private getRequestContext(req: FastifyRequest) {
    return {
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };
  }

  @Post('contracts')
  @RequirePermissions('contracts.amend')
  async createContract(
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() req: FastifyRequest,
    @Body() dto: CreateContractDto,
    @Headers('idempotency-key') idempotencyKey: unknown,
  ) {
    return this.documentsService.createContract(
      account.propertyId,
      account.accountId,
      dto,
      parseIdempotencyKey(idempotencyKey),
      this.getRequestContext(req)
    );
  }

  @Get('contracts')
  @RequirePermissions('contracts.read')
  async listContracts(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListContractsQueryDto
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 50);
    const items = await this.documentsService.listContracts(account.propertyId, page, limit, query.status, query.reference);
    return {
      data: items,
      total: items.length,
      page,
      limit
    };
  }

  @Get('contracts/:id')
  @RequirePermissions('contracts.read')
  async getContract(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string
  ) {
    return this.documentsService.getContract(account.propertyId, id);
  }

  @Post('contracts/:id/transition')
  @RequirePermissions('contracts.amend')
  async transitionContract(
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: TransitionContractDto,
    @Headers('idempotency-key') idempotencyKey: unknown,
  ) {
    if (dto.targetState === 'VOID' && !account.permissions.includes('contracts.void')) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.documentsService.transitionContract(
      account.propertyId,
      account.accountId,
      id,
      dto,
      parseIdempotencyKey(idempotencyKey),
      this.getRequestContext(req)
    );
  }

  @Post('contracts/:id/link-evidence')
  @RequirePermissions('evidence.manage')
  async linkEvidence(
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() dto: LinkEvidenceDto,
    @Headers('idempotency-key') idempotencyKey: unknown,
  ) {
    return this.documentsService.linkEvidence(
      account.propertyId,
      account.accountId,
      id,
      dto,
      parseIdempotencyKey(idempotencyKey),
      this.getRequestContext(req)
    );
  }

  @Post('evidences')
  @RequirePermissions('evidence.manage')
  async registerEvidence(
    @CurrentAccount() account: AuthenticatedAccount,
    @Req() req: FastifyRequest,
    @Body() dto: RegisterEvidenceDto,
    @Headers('idempotency-key') idempotencyKey: unknown,
  ) {
    return this.documentsService.registerEvidence(
      account.propertyId,
      account.accountId,
      dto,
      parseIdempotencyKey(idempotencyKey),
      this.getRequestContext(req)
    );
  }

  @Get('evidences')
  @RequirePermissions('evidence.read')
  async listEvidences(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListEvidenceQueryDto
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 50);
    const items = await this.documentsService.listEvidences(account.propertyId, page, limit, query.source, query.referenceId);
    return {
      data: items,
      total: items.length,
      page,
      limit
    };
  }

  @Get('audit')
  @RequirePermissions('audit.read')
  async listAuditEvents(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListAuditEventsQueryDto
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 50);
    const result = await this.documentsService.listAuditEvents(account.propertyId, page, limit, query);
    return {
      data: result.items,
      total: result.total,
      page,
      limit,
      hasNextPage: page * limit < result.total
    };
  }
}
