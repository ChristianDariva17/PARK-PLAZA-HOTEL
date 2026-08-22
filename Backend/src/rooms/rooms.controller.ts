import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseBlockRoomDto, parseRoomId, parseUpdateRoomDto } from './rooms.dto.js';
import { RoomsService } from './rooms.service.js';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @RequirePermissions('rooms.read')
  list(@CurrentAccount() account: AuthenticatedAccount) {
    return this.rooms.list(account.propertyId);
  }

  @Patch(':roomId')
  @RequirePermissions('rooms.update')
  update(@Param('roomId') roomId: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.rooms.update(actor, parseRoomId(roomId), parseUpdateRoomDto(body), getRequestContext(request));
  }

  @Patch(':roomId/block')
  @RequirePermissions('rooms.block')
  setBlocked(@Param('roomId') roomId: string, @Body() body: unknown, @CurrentAccount() actor: AuthenticatedAccount, @Req() request: AuthenticatedRequest) {
    return this.rooms.setBlocked(actor, parseRoomId(roomId), parseBlockRoomDto(body), getRequestContext(request));
  }
}
