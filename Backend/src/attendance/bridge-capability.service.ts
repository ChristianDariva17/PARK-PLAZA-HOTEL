import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type BridgeCapabilityOperation = 'health' | 'enroll' | 'verify';

interface BridgeCapabilityPayload {
  op: BridgeCapabilityOperation;
  st?: 'client' | 'employee';
  sid?: string;
  exp: number;
  jti: string;
}

export interface VerifiedBridgeCapability extends BridgeCapabilityPayload {}

@Injectable()
export class BridgeCapabilityService {
  private readonly secret: string;

  constructor(secret = process.env.BIOMETRIC_BRIDGE_CAPABILITY_SECRET) {
    if (!secret || secret.length < 32) throw new Error('BIOMETRIC_BRIDGE_CAPABILITY_SECRET must contain at least 32 characters');
    this.secret = secret;
  }

  issue(operation: BridgeCapabilityOperation, subject?: { type: 'client' | 'employee'; id: string }) {
    const expiresAt = new Date(Date.now() + 60_000);
    const payload: BridgeCapabilityPayload = {
      op: operation,
      exp: Math.floor(expiresAt.getTime() / 1000),
      jti: randomUUID(),
      ...(subject ? { st: subject.type, sid: subject.id } : {}),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return { token: `${encoded}.${this.sign(encoded)}`, expiresAt: expiresAt.toISOString() };
  }

  verify(token: string, operation: BridgeCapabilityOperation, subject?: { type: 'client' | 'employee'; id: string }) {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) throw new Error('Invalid bridge capability');
    const expected = this.sign(encoded);
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      throw new Error('Invalid bridge capability');
    }
    let payload: VerifiedBridgeCapability;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as VerifiedBridgeCapability;
    } catch {
      throw new Error('Invalid bridge capability');
    }
    if (payload.op !== operation || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error('Expired or mismatched bridge capability');
    }
    if (subject && (payload.st !== subject.type || payload.sid !== subject.id)) {
      throw new Error('Bridge capability subject mismatch');
    }
    return payload;
  }

  private sign(value: string) {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }
}
