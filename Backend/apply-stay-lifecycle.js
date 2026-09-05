import fs from 'fs';

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  for (const { from, to } of replacements) {
    if (from instanceof RegExp) {
      content = content.replace(from, to);
    } else {
      content = content.replaceAll(from, to);
    }
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

// 1. cleaning.schema.ts
let cleaningSchema = fs.readFileSync('src/database/schema/cleaning.schema.ts', 'utf-8');
cleaningSchema = cleaningSchema.replace("import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar }", "import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, varchar }");
cleaningSchema = cleaningSchema.replace("index('cleaning_tasks_stay_idx').on(t.stayId),", "unique('cleaning_tasks_stay_unique').on(t.stayId),");
cleaningSchema = cleaningSchema.replace("index('cleaning_commands_key_idx').on(t.propertyId, t.operation, t.idempotencyKey),", "unique('cleaning_commands_key_unique').on(t.propertyId, t.operation, t.idempotencyKey),");
fs.writeFileSync('src/database/schema/cleaning.schema.ts', cleaningSchema, 'utf-8');

// 2. cleaning.service.ts
let cleaningService = fs.readFileSync('src/cleaning/cleaning.service.ts', 'utf-8');
cleaningService = cleaningService.replace(
  "if (room && room.status === 'cleaning') {\\n          await tx.update(rooms).set({ status: 'available' }).where(eq(rooms.id, room.id));\\n          roomResponse = { id: room.id, status: 'available' };\\n        }",
  `if (room) {
          if (['blocked', 'maintenance', 'out_of_service'].includes(room.status)) {
            throw new ConflictException(\`Cannot approve cleaning task because room is \${room.status}\`);
          }
          if (room.status === 'cleaning') {
            await tx.update(rooms).set({ status: 'available' }).where(eq(rooms.id, room.id));
            roomResponse = { id: room.id, status: 'available' };
          }
        }`
);
fs.writeFileSync('src/cleaning/cleaning.service.ts', cleaningService, 'utf-8');

// 3. stays.service.ts
let staysService = fs.readFileSync('src/stays/stays.service.ts', 'utf-8');
staysService = staysService.replace(/cleaningComplete\([\s\S]*?\}\s*\}\n/m, '');
fs.writeFileSync('src/stays/stays.service.ts', staysService, 'utf-8');

// 4. stays.controller.ts
let staysController = fs.readFileSync('src/stays/stays.controller.ts', 'utf-8');
staysController = staysController.replace(/@Post\('rooms\/:id\/cleaning-complete'\)[\s\S]*?\}\n/m, '');
fs.writeFileSync('src/stays/stays.controller.ts', staysController, 'utf-8');

// 5. stays.controller.spec.ts (remove tests for cleaningComplete)
let staysControllerSpec = fs.readFileSync('test/stays.controller.spec.ts', 'utf-8');
staysControllerSpec = staysControllerSpec.replace(/describe\('cleaningComplete'[\s\S]*?\}\);\n/m, '');
fs.writeFileSync('test/stays.controller.spec.ts', staysControllerSpec, 'utf-8');

// 6. stays.service.spec.ts (remove tests for cleaningComplete)
let staysServiceSpec = fs.readFileSync('test/stays.service.spec.ts', 'utf-8');
staysServiceSpec = staysServiceSpec.replace(/describe\('cleaningComplete'[\s\S]*?\}\);\n\n  describe/m, 'describe');
fs.writeFileSync('test/stays.service.spec.ts', staysServiceSpec, 'utf-8');

console.log('Done applying stay lifecycle changes');
