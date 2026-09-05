import fs from 'fs';

function safeReplace(filePath, searchStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes(searchStr)) throw new Error(`Could not find search string in ${filePath}`);
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync(filePath, content, 'utf-8');
}

// 1. cleaning.schema.ts
safeReplace('src/database/schema/cleaning.schema.ts', 
  "import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, varchar }", 
  "import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, varchar }"
);
// just in case unique wasn't added
let cs = fs.readFileSync('src/database/schema/cleaning.schema.ts', 'utf-8');
if (!cs.includes(', unique,')) {
  cs = cs.replace("import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar }", "import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, varchar }");
}
if (!cs.includes("stayId: uuid('stay_id')")) {
  cs = cs.replace("reason: varchar('reason', { length: 255 }).notNull().default('Check-out completado'),\n  observation", "reason: varchar('reason', { length: 255 }).notNull().default('Check-out completado'),\n  stayId: uuid('stay_id'),\n  observation");
  cs = cs.replace("index('cleaning_tasks_room_idx').on(t.roomId),\n]);", "index('cleaning_tasks_room_idx').on(t.roomId),\n  unique('cleaning_tasks_stay_unique').on(t.stayId),\n]);");
}
fs.writeFileSync('src/database/schema/cleaning.schema.ts', cs, 'utf-8');

safeReplace('src/database/schema/cleaning.schema.ts',
  "index('cleaning_commands_key_idx').on(t.propertyId, t.operation, t.idempotencyKey),",
  "unique('cleaning_commands_key_unique').on(t.propertyId, t.operation, t.idempotencyKey),"
);

// 2. cleaning.service.ts
safeReplace('src/cleaning/cleaning.service.ts',
  `if (room && room.status === 'cleaning') {
          await tx.update(rooms).set({ status: 'available' }).where(eq(rooms.id, room.id));
          roomResponse = { id: room.id, status: 'available' };
        }`,
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

// 3. stays.service.ts (checkout should set stayId)
let staysService = fs.readFileSync('src/stays/stays.service.ts', 'utf-8');
if (!staysService.includes("stayId: stay.id,")) {
  safeReplace('src/stays/stays.service.ts',
    `        roomId: room.id,\n        status: 'pending',\n        assignedTo: 'Por asignar',\n        reason: 'Check-out completado',\n        evidence: [],`,
    `        roomId: room.id,\n        stayId: stay.id,\n        status: 'pending',\n        assignedTo: 'Por asignar',\n        reason: 'Check-out completado',\n        evidence: [],`
  );
}

// 4. stays.service.ts (remove cleaningComplete)
const staysServiceContent = fs.readFileSync('src/stays/stays.service.ts', 'utf-8');
if (staysServiceContent.includes("  cleaningComplete(")) {
  const cleaningCompleteStart = staysServiceContent.indexOf("  cleaningComplete(");
  const cleaningCompleteEnd = staysServiceContent.indexOf("  private async command(");
  if (cleaningCompleteStart === -1 || cleaningCompleteEnd === -1) throw new Error("Could not find cleaningComplete block");
  const newStaysService = staysServiceContent.substring(0, cleaningCompleteStart) + staysServiceContent.substring(cleaningCompleteEnd);
  fs.writeFileSync('src/stays/stays.service.ts', newStaysService, 'utf-8');
}

// 5. stays.controller.ts (remove endpoint)
const staysControllerContent = fs.readFileSync('src/stays/stays.controller.ts', 'utf-8');
if (staysControllerContent.includes("@Post('rooms/:id/cleaning-complete')")) {
  const endpointStart = staysControllerContent.indexOf("  @Post('rooms/:id/cleaning-complete')");
  const endpointEnd = staysControllerContent.indexOf("}", endpointStart);
  const newStaysController = staysControllerContent.substring(0, endpointStart) + staysControllerContent.substring(endpointEnd + 1);
  fs.writeFileSync('src/stays/stays.controller.ts', newStaysController, 'utf-8');
}

// 6. stays.controller.spec.ts
let staysControllerSpec = fs.readFileSync('test/stays.controller.spec.ts', 'utf-8');
if (staysControllerSpec.includes("cleaningComplete: vi.fn().mockResolvedValue({ id: 'stay-id' })")) {
  safeReplace('test/stays.controller.spec.ts',
    `      checkIn: vi.fn().mockResolvedValue({ id: 'stay-id' }), cleaningComplete: vi.fn().mockResolvedValue({ id: 'stay-id' }),`,
    `      checkIn: vi.fn().mockResolvedValue({ id: 'stay-id' }),`
  );
  safeReplace('test/stays.controller.spec.ts',
    `    await controller.cleaningComplete(roomId, key, actor, request as never);\n`,
    ``
  );
  safeReplace('test/stays.controller.spec.ts',
    `    expect(service.cleaningComplete).toHaveBeenCalledWith(actor, roomId, key, { requestId: 'request-id', ipAddress: '127.0.0.1', userAgent: 'test-agent' });\n`,
    ``
  );
  safeReplace('test/stays.controller.spec.ts',
    `    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, StaysController.prototype.cleaningComplete)).toEqual(['cleaning.progress']);\n`,
    ``
  );
}

// 7. stays.service.spec.ts (remove tests for cleaningComplete)
const staysServiceSpec = fs.readFileSync('test/stays.service.spec.ts', 'utf-8');
if (staysServiceSpec.includes("requires cleaning completion before returning a checked-out room to available")) {
  const testStart = staysServiceSpec.indexOf("  it('requires cleaning completion before returning a checked-out room to available'");
  const testEnd = staysServiceSpec.indexOf("  it('creates a walk-in reservation");
  if (testStart === -1 || testEnd === -1) throw new Error("Could not find test block");
  const newStaysServiceSpec = staysServiceSpec.substring(0, testStart) + staysServiceSpec.substring(testEnd);
  fs.writeFileSync('test/stays.service.spec.ts', newStaysServiceSpec, 'utf-8');
}

console.log('Success');
