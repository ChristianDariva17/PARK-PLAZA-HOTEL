import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { roles, permissions, rolePermissions, accounts } from '../database/schema/security.schema.js';
import type { CreateRoleDto, UpdateRoleDto } from './roles.dto.js';

@Injectable()
export class RolesService {
  constructor(@Inject(DATABASE) private db: Database) {}

  async getRoles() {
    const roleList = await this.db.select().from(roles).orderBy(roles.name);
    const result = [];
    for (const role of roleList) {
      const perms = await this.getRolePermissions(role.id);
      result.push({ ...role, permissions: perms });
    }
    return result;
  }

  async getPermissions() {
    return this.db.select().from(permissions).orderBy(permissions.key);
  }

  async getRolePermissions(roleId: string): Promise<string[]> {
    const records = await this.db
      .select({
        permissionKey: permissions.key,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
      
    return records.map(r => r.permissionKey);
  }

  async createRole(input: CreateRoleDto) {
    const rawKey = input.key || input.name.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const key = rawKey.substring(0, 64);

    const existing = await this.db.select().from(roles).where(eq(roles.key, key)).limit(1);
    if (existing[0]) {
      throw new ConflictException(`Ya existe un rol con la clave '${key}'.`);
    }

    return await this.db.transaction(async (tx) => {
      const created = await tx.insert(roles).values({
        key,
        name: input.name.trim(),
        isSystem: false,
      }).returning();
      const role = created[0]!;

      if (input.permissions && input.permissions.length > 0) {
        const matchingPerms = await tx.select().from(permissions).where(inArray(permissions.key, input.permissions));
        if (matchingPerms.length > 0) {
          await tx.insert(rolePermissions).values(
            matchingPerms.map(p => ({
              roleId: role.id,
              permissionId: p.id,
            }))
          );
        }
      }

      const perms = await this.getRolePermissions(role.id);
      return { ...role, permissions: perms };
    });
  }

  async updateRole(roleId: string, input: UpdateRoleDto) {
    const existing = await this.db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!existing[0]) {
      throw new NotFoundException('Rol no encontrado.');
    }
    const role = existing[0];

    return await this.db.transaction(async (tx) => {
      if (input.name && input.name.trim()) {
        await tx.update(roles).set({ name: input.name.trim() }).where(eq(roles.id, roleId));
      }

      if (input.permissions !== undefined) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

        if (input.permissions.length > 0) {
          const matchingPerms = await tx.select().from(permissions).where(inArray(permissions.key, input.permissions));
          if (matchingPerms.length > 0) {
            await tx.insert(rolePermissions).values(
              matchingPerms.map(p => ({
                roleId: role.id,
                permissionId: p.id,
              }))
            );
          }
        }
      }

      const updatedRole = (await tx.select().from(roles).where(eq(roles.id, roleId)).limit(1))[0]!;
      const perms = await this.getRolePermissions(role.id);
      return { ...updatedRole, permissions: perms };
    });
  }

  async deleteRole(roleId: string) {
    const existing = await this.db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!existing[0]) {
      throw new NotFoundException('Rol no encontrado.');
    }
    if (existing[0].isSystem) {
      throw new ConflictException('Los roles predefinidos del sistema no pueden ser eliminados.');
    }

    const assignedAccounts = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts)
      .where(eq(accounts.roleId, roleId));
      
    const count = Number(assignedAccounts[0]?.count || 0);
    if (count > 0) {
      throw new ConflictException(`No se puede eliminar el rol porque tiene ${count} usuario(s) asignado(s).`);
    }

    await this.db.delete(roles).where(eq(roles.id, roleId));
    return { success: true, id: roleId };
  }
}
