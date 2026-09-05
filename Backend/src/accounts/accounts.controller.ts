import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { AccountsService } from './accounts.service.js';
import { parseAccountId, parseApproveGoogleRequestDto, parseCreateAccountDto, parseResetPasswordDto, parseUpdateAccountDto } from './accounts.dto.js';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermissions('accounts.read')
  list(@CurrentAccount() account: AuthenticatedAccount) { return this.accounts.list(account.propertyId); }

  @Post()
  @RequirePermissions('accounts.manage')
  create(@Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.accounts.create(actor, parseCreateAccountDto(body), getRequestContext(request));
  }

  @Patch(':accountId')
  @RequirePermissions('accounts.manage')
  update(@Param('accountId') accountId: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.accounts.update(actor, parseAccountId(accountId), parseUpdateAccountDto(body), getRequestContext(request));
  }

  @Post(':accountId/reset-password')
  @RequirePermissions('accounts.manage')
  @HttpCode(204)
  resetPassword(@Param('accountId') accountId: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.accounts.resetPassword(actor, parseAccountId(accountId), parseResetPasswordDto(body), getRequestContext(request));
  }

  @Post('google-requests/:requestId/approve')
  @RequirePermissions('accounts.manage')
  approveGoogleRequest(@Param('requestId') requestId: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.accounts.approveGoogleRequest(actor, parseAccountId(requestId), parseApproveGoogleRequestDto(body), getRequestContext(request));
  }

  @Post('google-requests/:requestId/reject')
  @RequirePermissions('accounts.manage')
  @HttpCode(204)
  rejectGoogleRequest(@Param('requestId') requestId: string, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.accounts.rejectGoogleRequest(actor, parseAccountId(requestId), getRequestContext(request));
  }
}
