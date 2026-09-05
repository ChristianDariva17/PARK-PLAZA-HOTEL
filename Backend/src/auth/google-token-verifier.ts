import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Environment } from '../config/environment.js';

export interface GoogleIdentity {
  subject: string;
  email: string;
  displayName: string | null;
}

@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService<Environment, true>) {}

  async verify(credential: string, nonceHash: string | undefined): Promise<GoogleIdentity> {
    const clientId = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
    if (!clientId) throw new ServiceUnavailableException('Google Sign-In is not configured');

    try {
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload || (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com')) throw new Error('Invalid issuer');
      if (!payload.sub || payload.sub.length > 255 || !payload.email || payload.email.length > 254 || payload.email_verified !== true) throw new Error('Invalid identity');
      if (!nonceHash || typeof payload.nonce !== 'string') throw new Error('Missing nonce');
      const payloadNonceHash = createHash('sha256').update(payload.nonce).digest('hex');
      if (!timingSafeEqual(Buffer.from(payloadNonceHash), Buffer.from(nonceHash))) throw new Error('Invalid nonce');
      return {
        subject: payload.sub,
        email: payload.email.trim().toLowerCase(),
        displayName: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 200) : null,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new UnauthorizedException('Invalid Google credential');
    }
  }
}
