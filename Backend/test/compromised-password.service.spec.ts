import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompromisedPasswordService } from '../src/auth/compromised-password.service.js';

const service = new CompromisedPasswordService();

function digestParts(password: string): { digest: string; prefix: string; suffix: string } {
  const digest = createHash('sha1').update(password).digest('hex').toUpperCase();
  return { digest, prefix: digest.slice(0, 5), suffix: digest.slice(5) };
}

function differentSuffix(suffix: string): string {
  return `${suffix[0] === 'A' ? 'B' : 'A'}${suffix.slice(1)}`;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CompromisedPasswordService', () => {
  it('rejects an exact suffix match with a positive count', async () => {
    const password = 'compromised password';
    const { suffix } = digestParts(password);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`${suffix}:42\n`)));

    await expect(service.assertAcceptable(password)).rejects.toThrow('Password has appeared in a known data breach');
  });

  it('accepts a password absent from a valid response', async () => {
    const password = 'acceptable password';
    const { suffix } = digestParts(password);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`${differentSuffix(suffix)}:1\n`)));

    await expect(service.assertAcceptable(password)).resolves.toBeUndefined();
  });

  it('accepts CRLF responses', async () => {
    const password = 'acceptable password';
    const { suffix } = digestParts(password);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`${differentSuffix(suffix)}:1\r\n`)));

    await expect(service.assertAcceptable(password)).resolves.toBeUndefined();
  });

  it('does not treat a zero-count padding match as compromised', async () => {
    const password = 'padded password';
    const { suffix } = digestParts(password);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`${suffix}:0\n`)));

    await expect(service.assertAcceptable(password)).resolves.toBeUndefined();
  });

  it('fails closed when the request times out', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = expect(service.assertAcceptable('timeout password')).rejects.toThrow('Password safety service is unavailable');
    controller.abort(new DOMException('Timed out', 'TimeoutError'));
    await result;
    expect(timeout).toHaveBeenCalledWith(5_000);
  });

  it('fails closed on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(service.assertAcceptable('network password')).rejects.toThrow('Password safety service is unavailable');
  });

  it('fails closed on a non-success response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream error', { status: 503 })));

    await expect(service.assertAcceptable('any password')).rejects.toThrow('Password safety service is unavailable');
  });

  it('fails closed on an empty or malformed response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(''))
      .mockResolvedValueOnce(new Response('not-an-official-record\n'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.assertAcceptable('empty response')).rejects.toThrow('Password safety service is unavailable');
    await expect(service.assertAcceptable('malformed response')).rejects.toThrow('Password safety service is unavailable');
  });

  it('fails closed when the response exceeds the byte limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('A'.repeat(2 * 1024 * 1024 + 1))));

    await expect(service.assertAcceptable('oversized response')).rejects.toThrow('Password safety service is unavailable');
  });

  it('sends only the uppercase five-character prefix and required headers', async () => {
    const password = 'private password value';
    const { digest, prefix, suffix } = digestParts(password);
    const fetchMock = vi.fn().mockResolvedValue(new Response(`${differentSuffix(suffix)}:1\n`));
    vi.stubGlobal('fetch', fetchMock);

    await service.assertAcceptable(password);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${prefix}`);
    expect(url).not.toContain(password);
    expect(url).not.toContain(digest);
    expect(options.headers).toMatchObject({ 'Add-Padding': 'true', 'User-Agent': expect.stringContaining('ParkPlazaHotel-Backend') });
    expect(options).not.toHaveProperty('body');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
