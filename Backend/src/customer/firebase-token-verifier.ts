import { createPublicKey, verify } from 'node:crypto';

const CERTIFICATES_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const MAX_TOKEN_BYTES = 16_384;
const CLOCK_SKEW_SECONDS = 30;

interface FetchResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export type FirebaseCertificateFetcher = (url: string) => Promise<FetchResponse>;

export interface FirebaseIdentity {
  subject: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
}

type JwtHeader = { alg?: unknown; kid?: unknown };
type JwtClaims = Record<string, unknown>;

export class FirebaseTokenVerifier {
  private certificates = new Map<string, string>();
  private certificatesExpireAt = 0;

  constructor(
    private readonly projectId: string,
    private readonly fetcher: FirebaseCertificateFetcher = (url) => fetch(url),
    private readonly now: () => number = Date.now,
  ) {}

  async verify(idToken: string): Promise<FirebaseIdentity> {
    if (Buffer.byteLength(idToken, 'utf8') > MAX_TOKEN_BYTES) throw new Error('Invalid Firebase ID token');
    const segments = idToken.split('.');
    if (segments.length !== 3 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) throw new Error('Invalid Firebase ID token');
    const [encodedHeader, encodedClaims, encodedSignature] = segments as [string, string, string];
    const header = this.decodeJson<JwtHeader>(encodedHeader);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new Error('Invalid Firebase ID token header');

    const certificate = await this.certificateFor(header.kid);
    let signature: Buffer;
    try {
      signature = Buffer.from(encodedSignature, 'base64url');
    } catch {
      throw new Error('Invalid Firebase ID token signature');
    }
    const validSignature = verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedClaims}`), createPublicKey(certificate), signature);
    if (!validSignature) throw new Error('Invalid Firebase ID token signature');

    const claims = this.decodeJson<JwtClaims>(encodedClaims);
    this.assertClaims(claims);
    return {
      subject: claims.sub as string,
      email: (claims.email as string).trim().toLowerCase(),
      displayName: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 200) : null,
      photoUrl: typeof claims.picture === 'string' && claims.picture.length <= 2048 ? claims.picture : null,
    };
  }

  private decodeJson<T>(value: string): T {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed as T;
    } catch {
      throw new Error('Invalid Firebase ID token encoding');
    }
  }

  private assertClaims(claims: JwtClaims): void {
    const now = Math.floor(this.now() / 1000);
    if (claims.aud !== this.projectId || claims.iss !== `https://securetoken.google.com/${this.projectId}`) throw new Error('Invalid Firebase ID token audience');
    if (typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 128) throw new Error('Invalid Firebase ID token subject');
    if (typeof claims.email !== 'string' || claims.email.trim().length === 0 || claims.email.length > 254) throw new Error('Firebase ID token has no email');
    if (claims.email_verified !== true) throw new Error('Firebase email is not verified');
    for (const claim of ['exp', 'iat', 'auth_time'] as const) {
      if (typeof claims[claim] !== 'number' || !Number.isInteger(claims[claim]) || claims[claim] <= 0) throw new Error(`Invalid Firebase ID token ${claim}`);
    }
    if ((claims.exp as number) <= now - CLOCK_SKEW_SECONDS) throw new Error('Firebase ID token has expired');
    if ((claims.iat as number) > now + CLOCK_SKEW_SECONDS || (claims.auth_time as number) > now + CLOCK_SKEW_SECONDS) throw new Error('Firebase ID token is not yet valid');
    if ((claims.exp as number) <= (claims.iat as number) || (claims.auth_time as number) > (claims.iat as number)) throw new Error('Invalid Firebase ID token time claims');
  }

  private async certificateFor(keyId: string): Promise<string> {
    if (this.certificatesExpireAt > this.now()) {
      const cached = this.certificates.get(keyId);
      if (cached) return cached;
    }
    await this.refreshCertificates();
    const certificate = this.certificates.get(keyId);
    if (!certificate) throw new Error('Firebase signing key was not found');
    return certificate;
  }

  private async refreshCertificates(): Promise<void> {
    let response: FetchResponse;
    try {
      response = await this.fetcher(CERTIFICATES_URL);
    } catch {
      throw new Error('Unable to retrieve Firebase signing keys');
    }
    if (!response.ok) throw new Error(`Unable to retrieve Firebase signing keys (${response.status})`);
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid Firebase signing key response');
    const entries = Object.entries(body).filter((entry): entry is [string, string] => Boolean(entry[0]) && typeof entry[1] === 'string' && /BEGIN (?:CERTIFICATE|PUBLIC KEY)/.test(entry[1]));
    if (entries.length === 0) throw new Error('Firebase signing key response was empty');
    const cacheControl = response.headers.get('cache-control') ?? '';
    const maximumAge = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl)?.[1];
    this.certificates = new Map(entries);
    this.certificatesExpireAt = maximumAge ? this.now() + Number(maximumAge) * 1000 : this.now();
  }
}
