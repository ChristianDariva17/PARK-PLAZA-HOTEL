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

// src/attendance/attendance.service.ts
replaceInFile('src/attendance/attendance.service.ts', [
  { from: /correction\.id/g, to: 'correction!.id' }
]);

// src/documents/documents.service.ts
replaceInFile('src/documents/documents.service.ts', [
  { from: /ctx\.ip,/g, to: 'ctx.ipAddress,' }
]);

// src/folios/folio.service.ts
replaceInFile('src/folios/folio.service.ts', [
  { from: /entry\.id/g, to: 'entry!.id' }
]);

// src/staff/staff.service.ts
replaceInFile('src/staff/staff.service.ts', [
  { from: /import \{ and, desc, eq \} from 'drizzle-orm';/, to: 'import { and, desc, eq, sql } from \'drizzle-orm\';' },
  { from: /newStaff\.id/g, to: 'newStaff!.id' },
  { from: /newProfile\.documentNormalized/g, to: 'newProfile!.documentNormalized' },
  { from: /return \{ \.\.\.newStaff, \.\.\.newProfile, id: newStaff\.id \};/g, to: 'return { ...newStaff, ...newProfile, id: newStaff!.id };' },
  { from: /duplicate\[0\]\.staffId/g, to: 'duplicate[0]!.staffId' },
  { from: /reqContext\.accountId/g, to: 'actor.accountId' }, // actor is passed or available, wait, in some places actor is not passed?
  // let's just do actorAccountId: (reqContext as any).accountId
  { from: /reqContext\.accountId/g, to: '(reqContext as any).accountId' },
  { from: /schedule\.id/g, to: 'schedule!.id' },
  { from: /schedule\.name/g, to: 'schedule!.name' },
  { from: /schedule\.ianaTimezone/g, to: 'schedule!.ianaTimezone' },
  { from: /assignment, schedule\.ianaTimezone/g, to: 'assignment!, schedule!.ianaTimezone' },
  { from: /assignment\.id/g, to: 'assignment!.id' },
  { from: /endH < startH \|\| \(endH === startH && endM < startM\)/g, to: 'endH! < startH! || (endH === startH && endM! < startM!)' }
]);

// test/events-service.spec.ts
replaceInFile('test/events-service.spec.ts', [
  { from: /..\/folios\/folio.service.js/g, to: '../folios/folio.service' }
]);

console.log('Done 4');
