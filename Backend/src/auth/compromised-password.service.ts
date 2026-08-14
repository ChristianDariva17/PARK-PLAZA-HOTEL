import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';

const API_URL = 'https://api.pwnedpasswords.com/range/';
const API_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const RESPONSE_LINE = /^([A-F0-9]{35}):(0|[1-9][0-9]*)$/;
const USER_AGENT = 'ParkPlazaHotel-Backend/0.1.0 (compromised-password-check)';

@Injectable()
export class CompromisedPasswordService {
  async assertAcceptable(password: string): Promise<void> {
    const digest = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = digest.slice(0, 5);
    const suffix = digest.slice(5);
    let compromised: boolean;
    try {
      compromised = await this.rangeContains(prefix, suffix);
    } catch {
      throw new ServiceUnavailableException('Password safety service is unavailable');
    }
    if (compromised) throw new BadRequestException('Password has appeared in a known data breach');
  }

  private async rangeContains(prefix: string, expectedSuffix: string): Promise<boolean> {
    const response = await fetch(`${API_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok || !response.body) throw new Error('Pwned Passwords request failed');

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytesRead = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytesRead += result.value.byteLength;
      if (bytesRead > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Pwned Passwords response is too large');
      }
      chunks.push(result.value);
    }

    const bytes = new Uint8Array(bytesRead);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const contents = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const lines = contents.split('\n');
    if (lines.at(-1) === '') lines.pop();
    if (lines.length === 0) throw new Error('Pwned Passwords response is empty');

    let compromised = false;
    for (const rawLine of lines) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      const match = RESPONSE_LINE.exec(line);
      if (!match) throw new Error('Pwned Passwords response is malformed');
      if (match[1] === expectedSuffix && match[2] !== '0') compromised = true;
    }
    return compromised;
  }
}
