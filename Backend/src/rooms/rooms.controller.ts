import { Body, Controller, Get, Param, Patch, Put, Req } from '@nestjs/common';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { parseBlockRoomDto, parseCategoryId, parseRoomId, parseUpdateCategoryAmenitiesDto, parseUpdateCategoryDto, parseUpdateRoomDto } from './rooms.dto.js';
import { RoomsService } from './rooms.service.js';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('amenities')
  @RequirePermissions('rooms.read')
  listAmenities(@CurrentAccount() account: AuthenticatedAccount) {
    return this.rooms.listAmenities(account.propertyId);
  }

  @Get('categories')
  @RequirePermissions('rooms.read')
  listCategories(@CurrentAccount() account: AuthenticatedAccount) {
    return this.rooms.listCategories(account.propertyId);
  }

  @Get('categories/:categoryId/amenities')
  @RequirePermissions('rooms.read')
  getCategoryAmenities(
    @Param('categoryId') categoryId: string,
    @CurrentAccount() account: AuthenticatedAccount,
  ) {
    return this.rooms.getCategoryAmenities(account.propertyId, parseCategoryId(categoryId));
  }

  @Put('categories/:categoryId/amenities')
  @RequirePermissions('rooms.update')
  updateCategoryAmenities(
    @Param('categoryId') categoryId: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    const dto = parseUpdateCategoryAmenitiesDto(body);
    return this.rooms.updateCategoryAmenities(actor, parseCategoryId(categoryId), dto.amenityKeys, getRequestContext(request));
  }

  @Get('categories/:categoryId/audit')
  @RequirePermissions('rooms.read')
  getCategoryAudit(
    @Param('categoryId') categoryId: string,
    @CurrentAccount() account: AuthenticatedAccount,
  ) {
    return this.rooms.getCategoryAuditHistory(account.propertyId, parseCategoryId(categoryId));
  }

  @Patch('categories/:categoryId')
  @RequirePermissions('rooms.update')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() body: unknown,
    @CurrentAccount() actor: AuthenticatedAccount,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.rooms.updateCategory(actor, parseCategoryId(categoryId), parseUpdateCategoryDto(body), getRequestContext(request));
  }

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
