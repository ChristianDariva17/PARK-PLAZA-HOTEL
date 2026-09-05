import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { parseCreateRoleDto, parseRoleId, parseUpdateRoleDto } from './roles.dto.js';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.read')
  async getRoles() {
    return this.rolesService.getRoles();
  }

  @Get('permissions')
  @RequirePermissions('roles.read')
  async getPermissions() {
    return this.rolesService.getPermissions();
  }

  @Post()
  @RequirePermissions('roles.manage')
  async createRole(@Body() body: unknown) {
    const input = parseCreateRoleDto(body);
    return this.rolesService.createRole(input);
  }

  @Patch(':id')
  @RequirePermissions('roles.manage')
  async updateRole(@Param('id') id: unknown, @Body() body: unknown) {
    const roleId = parseRoleId(id);
    const input = parseUpdateRoleDto(body);
    return this.rolesService.updateRole(roleId, input);
  }

  @Delete(':id')
  @RequirePermissions('roles.manage')
  async deleteRole(@Param('id') id: unknown) {
    const roleId = parseRoleId(id);
    return this.rolesService.deleteRole(roleId);
  }
}
