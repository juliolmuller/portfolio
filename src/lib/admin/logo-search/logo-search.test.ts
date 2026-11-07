import { describe, expect, it, vi } from 'vitest';

import { type AiProvider } from '@/lib/ai/provider';

import { createRemoteIconFetcher, isBlockedAddress, type RemoteIconResult } from './remote-icon';
import { createLogoSearch, parseCandidates } from './search';

const SVG = '<svg viewBox="0 0 10 10"><path d="M1 1h8v8H1z"/></svg>';
const svgResponse = (body = SVG, type = 'image/svg+xml'): Response =>
  new Response(body, { headers: { 'content-type': type } });
const publicDns = (): Promise<string[]> => Promise.resolve(['93.184.216.34']);

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '224.0.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
  ])('blocks %s', (address) => expect(isBlockedAddress(address)).toBe(true));

  it.each(['93.184.216.34', '8.8.8.8', '2606:4700::1111'])('allows %s', (address) =>
    expect(isBlockedAddress(address)).toBe(false),
  );
});

describe('createRemoteIconFetcher', () => {
  const make = (
    fetchImpl: typeof fetch,
    resolve = publicDns,
  ): ReturnType<typeof createRemoteIconFetcher> => createRemoteIconFetcher({ fetchImpl, resolve });

  it('imports a valid SVG', async () => {
    const result = await make(() => Promise.resolve(svgResponse())).fetch('https://a.test/x.svg');

    expect(result.ok).toBe(true);
  });

  it.each(['http://a.test/x.svg', 'https://a.test:8443/x.svg', 'https://u:p@a.test/x.svg', 'nope'])(
    'refuses %s',
    async (url) => {
      const fetchImpl = vi.fn();

      expect((await make(fetchImpl).fetch(url)).ok).toBe(false);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('refuses bracketed IPv6 literals', async () => {
    expect((await make(vi.fn()).fetch('https://[::1]/x.svg')).ok).toBe(false);
  });

  it('refuses hosts resolving to private addresses', async () => {
    const result = await make(vi.fn(), () => Promise.resolve(['10.0.0.5'])).fetch(
      'https://a.test/x.svg',
    );

    expect(result.ok).toBe(false);
  });

  it('re-validates redirects and caps hops', async () => {
    const redirect = (to: string): Response =>
      new Response(null, { status: 302, headers: { location: to } });
    const toPrivate = make(() => Promise.resolve(redirect('https://127.0.0.1/x.svg')));
    const loop = make(() => Promise.resolve(redirect('https://a.test/y.svg')));

    expect((await toPrivate.fetch('https://a.test/x.svg')).ok).toBe(false);
    expect(await loop.fetch('https://a.test/x.svg')).toMatchObject({
      message: expect.stringContaining('redirects too many'),
    });
  });

  it('rejects oversize, wrong type and non-SVG bodies', async () => {
    const big = svgResponse(`<svg>${'a'.repeat(200 * 1024)}</svg>`);

    expect((await make(() => Promise.resolve(big)).fetch('https://a.test/x.svg')).ok).toBe(false);
    expect(
      (await make(() => Promise.resolve(svgResponse(SVG, 'image/png'))).fetch('https://a.test/x'))
        .ok,
    ).toBe(false);
    expect(
      (
        await make(() => Promise.resolve(svgResponse('hello', 'text/plain'))).fetch(
          'https://a.test/x',
        )
      ).ok,
    ).toBe(false);
  });

  it('enforces the host allowlist', async () => {
    const fetcher = createRemoteIconFetcher({
      allowedHosts: new Set(['ok.test']),
      fetchImpl: () => Promise.resolve(svgResponse()),
      resolve: publicDns,
    });

    expect((await fetcher.fetch('https://other.test/x.svg')).ok).toBe(false);
    expect((await fetcher.fetch('https://ok.test/x.svg')).ok).toBe(true);
  });
});

describe('parseCandidates', () => {
  it('extracts the first JSON object from noisy text', () => {
    const text =
      'Sure! {"candidates":[{"url":"https://cdn.jsdelivr.net/a.svg","variant":"mark"}]} done';

    expect(parseCandidates(text)).toHaveLength(1);
    expect(parseCandidates('no json')).toEqual([]);

    const many = JSON.stringify({
      candidates: Array.from({ length: 9 }, (_, i) => ({
        url: `https://cdn.jsdelivr.net/${i}.svg`,
      })),
    });

    expect(parseCandidates(many)).toHaveLength(6);
    expect(parseCandidates('{"candidates":[{"url":"not a url"}]}')).toEqual([]);
  });
});

describe('createLogoSearch', () => {
  const ai = (text: string, configured = true): AiProvider => ({
    id: 'fake',
    isConfigured: () => configured,
    complete: () => Promise.resolve({ text, provider: 'fake', model: 'm' }),
  });
  const answer = JSON.stringify({
    candidates: [
      { url: 'https://cdn.jsdelivr.net/a.svg', variant: 'wordmark' },
      { url: 'https://cdn.jsdelivr.net/b.svg', variant: 'mark' },
      { url: 'https://evil.test/c.svg', variant: 'mark' },
      { url: 'https://cdn.jsdelivr.net/missing.svg', variant: 'mark' },
    ],
  });
  const fetcher = {
    fetch: (url: string): Promise<RemoteIconResult> =>
      Promise.resolve(
        url.includes('missing')
          ? { ok: false as const, message: '404' }
          : { ok: true as const, svg: { viewBox: '0 0 10 10', paths: ['M1 1h8v8H1z'] } },
      ),
  };

  it('filters hosts, drops unimportable logos and ranks marks first', async () => {
    const result = await createLogoSearch({ ai: ai(answer), fetcher })('Bun');

    expect(result.status).toBe('ok');
    expect(result.results.map((r) => r.url)).toEqual([
      'https://cdn.jsdelivr.net/b.svg',
      'https://cdn.jsdelivr.net/a.svg',
    ]);
  });

  it('reports no-match and ai-unavailable', async () => {
    expect((await createLogoSearch({ ai: ai('{}'), fetcher })('Bun')).status).toBe('no-match');
    expect((await createLogoSearch({ ai: ai('', false), fetcher })('Bun')).status).toBe(
      'ai-unavailable',
    );
  });
});
