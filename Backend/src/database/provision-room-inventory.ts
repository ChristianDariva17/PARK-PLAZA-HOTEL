import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import { databaseUrlFromEnv, validateEnv } from '../config/environment.js';
import { properties, roomCategories, rooms } from './schema/index.js';
import { acquirePropertyTransactionLock } from './transaction-policy.js';

export interface RoomInventoryCategory {
  code: string;
  name: string;
  capacity: number;
  baseNightlyRate: string;
}

export interface RoomInventoryRoom {
  number: string;
  floor: number;
  categoryCode: string;
}

export const PARK_PLAZA_ROOM_CATEGORIES: readonly RoomInventoryCategory[] = Object.freeze([
  { code: 'SIMPLE', name: 'Simple', capacity: 1, baseNightlyRate: '95.00' },
  { code: 'MATRIMONIAL', name: 'Matrimonial', capacity: 2, baseNightlyRate: '130.00' },
  { code: 'DOBLE', name: 'Doble', capacity: 2, baseNightlyRate: '145.00' },
  { code: 'TRIPLE', name: 'Triple', capacity: 3, baseNightlyRate: '175.00' },
  { code: 'SUITE', name: 'Suite', capacity: 4, baseNightlyRate: '260.00' },
]);

const categoryCodes = PARK_PLAZA_ROOM_CATEGORIES.map((category) => category.code);
const floorRoomCounts = [[1, 8], [2, 8], [3, 11], [4, 11]] as const;

export const PARK_PLAZA_ROOMS: readonly RoomInventoryRoom[] = Object.freeze(floorRoomCounts.flatMap(([floor, count]) => (
  Array.from({ length: count }, (_, index) => {
    const number = floor * 100 + index + 1;
    return { number: String(number), floor, categoryCode: categoryCodes[(number + floor) % categoryCodes.length]! };
  })
)));

const decimalEquals = (left: string, right: string) => Number(left).toFixed(2) === Number(right).toFixed(2);

export function assertCompatibleCategory(existing: Pick<RoomInventoryCategory, 'name' | 'capacity' | 'baseNightlyRate'>, expected: RoomInventoryCategory): void {
  if (existing.name !== expected.name || existing.capacity !== expected.capacity) {
    throw new Error(`Room category ${expected.code} conflicts with the provisioned definition`);
  }
}

export function assertCompatibleRoom(existing: { floor: number; categoryId: string }, expected: RoomInventoryRoom, expectedCategoryId: string): void {
  if (existing.floor !== expected.floor || existing.categoryId !== expectedCategoryId) {
    throw new Error(`Room ${expected.number} conflicts with the provisioned inventory`);
  }
}

const propertyCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/);

export async function provisionRoomInventory(propertyCode: string): Promise<void> {
  const code = propertyCodeSchema.parse(propertyCode);
  await import('dotenv/config');
  const env = validateEnv(process.env);
  const pool = new Pool({ connectionString: databaseUrlFromEnv(env), ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false, max: 1 });
  const database = drizzle(pool, { schema: { properties, roomCategories, rooms } });
  try {
    await database.transaction(async (tx) => {
      const propertyRows = await tx.select({ id: properties.id }).from(properties).where(eq(properties.code, code)).limit(2);
      if (propertyRows.length !== 1) throw new Error(propertyRows.length ? 'Property code is ambiguous' : 'Property code was not found');
      const propertyId = propertyRows[0]!.id;
      await acquirePropertyTransactionLock(tx, propertyId);

      const categoryIds = new Map<string, string>();
      for (const definition of PARK_PLAZA_ROOM_CATEGORIES) {
        const existingRows = await tx.select({
          id: roomCategories.id,
          name: roomCategories.name,
          capacity: roomCategories.capacity,
          baseNightlyRate: roomCategories.baseNightlyRate,
        }).from(roomCategories).where(and(eq(roomCategories.propertyId, propertyId), eq(roomCategories.code, definition.code))).limit(1);
        const existing = existingRows[0];
        if (existing) {
          assertCompatibleCategory(existing, definition);
          categoryIds.set(definition.code, existing.id);
        } else {
          const inserted = await tx.insert(roomCategories).values({ propertyId, ...definition }).returning({ id: roomCategories.id });
          categoryIds.set(definition.code, inserted[0]!.id);
        }
      }

      for (const definition of PARK_PLAZA_ROOMS) {
        const categoryId = categoryIds.get(definition.categoryCode)!;
        const existingRows = await tx.select({ floor: rooms.floor, categoryId: rooms.categoryId }).from(rooms)
          .where(and(eq(rooms.propertyId, propertyId), eq(rooms.number, definition.number))).limit(1);
        if (existingRows[0]) {
          assertCompatibleRoom(existingRows[0], definition, categoryId);
        } else {
          await tx.insert(rooms).values({ propertyId, categoryId, number: definition.number, floor: definition.floor, status: 'available' });
        }
      }
    });
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  if (process.argv.length !== 3) throw new Error('Usage: npm run provision:rooms -- <property-code>');
  await provisionRoomInventory(process.argv[2]!);
}
