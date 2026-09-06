import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';

export type BridgeCapabilityOperation = 'health' | 'enroll' | 'verify';

interface BridgeCapabilityPayload {
  op: BridgeCapabilityOperation;
  st?: 'client' | 'employee';
  sid?: string;
  exp: number;
  jti: string;
}

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

  private sign(value: string) {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }
}
