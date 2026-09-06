import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

interface QrPayload {
  p: string; // propertyId
  t: number; // timestamp in ms
  n: string; // nonce uuid
}

@Injectable()
export class DynamicQrService {
  private readonly secretKey: string;

  // Anti-replay cache: stores consumed nonces with timestamp to prevent duplicate punches
  private readonly consumedNonces = new Map<string, number>();

  constructor(secretKey = process.env.ATTENDANCE_QR_SECRET) {
    if (!secretKey || secretKey.length < 32) {
      throw new Error('ATTENDANCE_QR_SECRET must contain at least 32 characters');
    }
    this.secretKey = secretKey;

    // Purge expired nonces every 2 minutes
    setInterval(() => {
      const cutoff = Date.now() - 60000;
      for (const [nonce, timestamp] of this.consumedNonces.entries()) {
        if (timestamp < cutoff) {
          this.consumedNonces.delete(nonce);
        }
      }
    }, 120000).unref();
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
  verifyAndConsumeToken(tokenString: string, expectedPropertyId: string): { propertyId: string; timestamp: Date } {
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

    const now = Date.now();
    const ageMs = now - payload.t;

    // Allowed validity: 25 seconds (20s cycle + 5s network grace)
    if (ageMs > 25000) {
      throw new BadRequestException('El código QR ha expirado. Escaneá el código actualizado en la pantalla.');
    }

    if (ageMs < -5000) {
      throw new BadRequestException('La hora del código QR no concuerda con el servidor.');
    }

    // Anti-replay check
    if (this.consumedNonces.has(payload.n)) {
      throw new BadRequestException('Este código QR ya fue utilizado. Por favor esperá el siguiente en pantalla.');
    }

    // Mark as consumed
    this.consumedNonces.set(payload.n, now);

    return {
      propertyId: payload.p,
      timestamp: new Date(payload.t),
    };
  }

  private sign(data: string): string {
    return createHmac('sha256', this.secretKey).update(data).digest('base64url');
  }
}
