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

// 1. Fix staff.service.ts actor issue and sql import
let staffContent = fs.readFileSync('src/staff/staff.service.ts', 'utf-8');
staffContent = staffContent.replaceAll('actor.accountId', '(reqContext as any).accountId');
if (!staffContent.includes('import { sql }')) {
  staffContent = "import { sql } from 'drizzle-orm';\n" + staffContent;
}
staffContent = staffContent.replaceAll('assignment, schedule!.ianaTimezone', 'assignment!, schedule!.ianaTimezone');
fs.writeFileSync('src/staff/staff.service.ts', staffContent, 'utf-8');

// 2. Fix events-service.spec.ts
replaceInFile('test/events-service.spec.ts', [
  { from: '../folios/folio.service', to: '../folios/folio.service.js' },
  { from: '../folios/folio.service.js.js', to: '../folios/folio.service.js' } // in case it was duplicated
]);

console.log('Done 5');
