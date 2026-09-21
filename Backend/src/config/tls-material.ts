import { readFileSync } from 'node:fs';

export function resolveTlsCa(certificate: string | undefined, certificateFile: string | undefined): string | undefined {
  if (!certificateFile) return certificate;
  return readFileSync(certificateFile, 'utf8');
}
