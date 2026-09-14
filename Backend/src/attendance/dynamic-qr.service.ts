import { Inject, Injectable, BadRequestException, UnauthorizedException, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { lt } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { attendanceQrNonces } from '../database/schema/index.js';

interface QrPayload {
  p: string; // propertyId
  t: number; // timestamp in ms
  n: string; // nonce uuid
  e: number; // expiry timestamp in ms
}

export interface VerifiedQrToken {
  propertyId: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class DynamicQrService implements OnModuleInit, OnApplicationShutdown {
  private readonly secretKey: string;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(@Inject(DATABASE) private readonly database: Database) {
    const secretKey = process.env.ATTENDANCE_QR_SECRET;
    if (!secretKey || secretKey.length < 32) {
      throw new Error('ATTENDANCE_QR_SECRET must contain at least 32 characters');
    }
    this.secretKey = secretKey;
  }

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredNonces().catch(() => undefined);
    }, 120_000);
    this.cleanupTimer.unref();
  }

  onApplicationShutdown(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  /**
   * Generates a signed, time-limited QR token for a property's kiosk display.
   */
  generateKioskToken(propertyId: string, ttlSeconds: number = 20): { token: string; expiresAt: string; refreshIntervalMs: number } {
    const timestamp = Date.now();
    const payload: QrPayload = {
      p: propertyId,
      t: timestamp,
      n: randomUUID(),
      e: timestamp + ttlSeconds * 1000,
    };

    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(payloadEncoded);
    const token = `${payloadEncoded}.${signature}`;

    return {
      token,
      expiresAt: new Date(timestamp + ttlSeconds * 1000).toISOString(),
      refreshIntervalMs: ttlSeconds * 1000,
    };
  }

  /**
   * Validates a scanned QR token against the property, signature, expiration window, and anti-replay protection.
   */
  verifyToken(tokenString: string, expectedPropertyId: string): VerifiedQrToken {
    if (!tokenString || typeof tokenString !== 'string') {
      throw new BadRequestException('Token de QR inválido o vacío');
    }

    const parts = tokenString.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BadRequestException('Formato de token QR inválido');
    }

    const payloadEncoded = parts[0];
    const signature = parts[1];
    const expectedSignature = this.sign(payloadEncoded);

    // Timing-safe signature check
    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedSigBuffer.length || !timingSafeEqual(sigBuffer, expectedSigBuffer)) {
      throw new UnauthorizedException('Firma de código QR inválida o alterada');
    }

    let payload: QrPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf-8'));
    } catch {
      throw new BadRequestException('Payload de código QR ilegible');
    }

    if (payload.p !== expectedPropertyId) {
      throw new BadRequestException('El código QR no corresponde a esta propiedad del hotel');
    }

    if (!payload.n || !payload.e || !Number.isFinite(payload.t) || !Number.isFinite(payload.e)) {
      throw new BadRequestException('Payload de código QR inválido');
    }

    const now = Date.now();
    const ageMs = now - payload.t;

    // Allowed validity: 25 seconds (20s cycle + 5s network grace)
    if (now > payload.e + 5000) {
      throw new BadRequestException('El código QR ha expirado. Escaneá el código actualizado en la pantalla.');
    }

    if (ageMs < -5000) {
      throw new BadRequestException('La hora del código QR no concuerda con el servidor.');
    }

    return {
      propertyId: payload.p,
      nonce: payload.n,
      issuedAt: new Date(payload.t),
      expiresAt: new Date(payload.e),
    };
  }

  async consumeToken(transaction: Pick<Database, 'insert'>, token: VerifiedQrToken): Promise<void> {
    const inserted = await (transaction as any).insert(attendanceQrNonces).values({
      nonce: token.nonce,
      propertyId: token.propertyId,
      issuedAt: token.issuedAt,
      expiresAt: token.expiresAt,
      consumedAt: new Date(),
    }).onConflictDoNothing({ target: attendanceQrNonces.nonce }).returning({ nonce: attendanceQrNonces.nonce });

    if (!inserted.length) {
      throw new BadRequestException('Este código QR ya fue utilizado. Por favor esperá el siguiente en pantalla.');
    }
  }

  private async cleanupExpiredNonces(): Promise<void> {
    await this.database.delete(attendanceQrNonces).where(lt(attendanceQrNonces.expiresAt, new Date()));
  }

  private sign(data: string): string {
    return createHmac('sha256', this.secretKey).update(data).digest('base64url');
  }
}
