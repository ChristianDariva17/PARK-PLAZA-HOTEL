import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function scrypt(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

@Injectable()
export class CryptoService {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, KEY_LENGTH);
    return `scrypt$v=1$N=${SCRYPT_OPTIONS.N},r=${SCRYPT_OPTIONS.r},p=${SCRYPT_OPTIONS.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
  }

  async verifyPassword(password: string, encoded: string): Promise<boolean> {
    try {
      const [algorithm, version, parameters, saltValue, keyValue] = encoded.split('$');
      if (algorithm !== 'scrypt' || version !== 'v=1' || parameters !== 'N=16384,r=8,p=1' || !saltValue || !keyValue) return false;
      const expected = Buffer.from(keyValue, 'base64url');
      const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  createOpaqueToken(): string { return randomBytes(32).toString('base64url'); }
  hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
  hashLoginKey(value: string): string { return createHash('sha256').update(value).digest('hex'); }
}
