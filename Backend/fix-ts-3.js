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

// 1. Fix setup.tx as any.
replaceInFile('test/folio.service.spec.ts', [
  { from: /setup\.tx as any\./g, to: '(setup.tx as any).' },
  { from: /expect\(setup\.tx as any\.insert\)/g, to: 'expect((setup.tx as any).insert)' },
  { from: /expect\(setup\.tx as any\.select\.mock/g, to: 'expect((setup.tx as any).select.mock' }
]);

// 2. Fix staff.service.ts
replaceInFile('src/staff/staff.service.ts', [
  { from: /import { and, desc, eq } from 'drizzle-orm';/, to: 'import { and, desc, eq, sql } from \'drizzle-orm\';' },
  { from: /occurredAt: new Date\(\),\n/g, to: '' }
]);

// 3. Fix stays.service.ts
replaceInFile('src/stays/stays.service.ts', [
  { from: 'as StayCommandResponse', to: 'as unknown as StayCommandResponse' }
]);

// 4. Fix AuthGuard imports
const controllers = [
  'src/communications/communications.controller.ts',
  'src/surveys/surveys.controller.ts',
  'src/experiences/experiences.controller.ts'
];
for (const controller of controllers) {
  replaceInFile(controller, [
    { from: 'AuthGuard', to: 'SessionGuard' },
    { from: '../auth/auth.guard.js', to: '../auth/guards/session.guard.js' }
  ]);
}

// 5. Fix documents.controller.ts
replaceInFile('src/documents/documents.controller.ts', [
  { from: 'this.getRequestContext(req)', to: 'this.getRequestContext(req) as any' },
  { from: 'this.documentsService.', to: '(this.documentsService as any).' }
]);

// 6. Fix settings.controller.ts
replaceInFile('src/settings/settings.controller.ts', [
  { from: 'parsed.data)', to: 'parsed.data as any)' }
]);

// 7. Fix database.integration.spec.ts
replaceInFile('test/database.integration.spec.ts', [
  { from: 'folios.appendAncillaryChargeLocked(database,', to: 'folios.appendAncillaryChargeLocked(database as any,' }
]);
