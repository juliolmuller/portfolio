import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { type LogoCandidate, type LogoProvider } from './provider';
import { parseCandidates } from './providers/ai';
import { createRemoteIconFetcher, isBlockedAddress, type RemoteIconResult } from './remote-icon';
import { createLogoSearch } from './search';

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
    'febf::1',
    '172.31.255.255',
    '100.64.0.0',
    '100.127.255.255',
    '198.19.255.255',
    '192.0.0.1',
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
  ])('blocks %s', (address) => expect(isBlockedAddress(address)).toBe(true));

  it.each([
    '93.184.216.34',
    '8.8.8.8',
    '2606:4700::1111',
    'fec0::1',
    '172.15.255.255',
    '172.32.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '198.20.0.1',
    '192.0.64.1',
  ])('allows %s', (address) => expect(isBlockedAddress(address)).toBe(false));
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

  it('connects to the validated address on every hop', async () => {
    const seen: string[] = [];
    const resolve = (host: string): Promise<string[]> =>
      Promise.resolve([host === 'a.test' ? '93.184.216.34' : '93.184.216.35']);
    let calls = 0;
    const fetcher = createRemoteIconFetcher({
      resolve,
      fetchImpl: (_url, _init, address) => {
        seen.push(address);
        calls += 1;

        return Promise.resolve(
          calls === 1
            ? new Response(null, { status: 302, headers: { location: 'https://b.test/x.svg' } })
            : svgResponse(),
        );
      },
    });

    expect((await fetcher.fetch('https://a.test/x.svg')).ok).toBe(true);
    expect(seen).toEqual(['93.184.216.34', '93.184.216.35']);
  });

  it('refuses hosts resolving to a mix of public and private addresses', async () => {
    const fetchImpl = vi.fn();
    const result = await make(fetchImpl, () =>
      Promise.resolve(['93.184.216.34', '10.0.0.5']),
    ).fetch('https://a.test/x.svg');

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
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

  it('accepts transparent rasters and refuses JPEG or oversize ones', async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const raster = (body: Uint8Array, type: string): Response =>
      new Response(Buffer.from(body), { headers: { 'content-type': type } });

    expect(
      await make(() => Promise.resolve(raster(png, 'image/png'))).fetch('https://a.test/x.png'),
    ).toMatchObject({ ok: true, image: expect.any(Buffer) });
    expect(
      (
        await make(() =>
          Promise.resolve(raster(Uint8Array.from([0xff, 0xd8, 0xff, 0]), 'image/png')),
        ).fetch('https://a.test/x.png')
      ).ok,
    ).toBe(false);
    expect(
      (
        await make(() =>
          Promise.resolve(raster(new Uint8Array(1024 * 1024 + 1), 'image/png')),
        ).fetch('https://a.test/x.png')
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
    expect(parseCandidates('{"candidates":[{"url":"not a url"}]}')).toEqual([]);
  });
});

describe('createLogoSearch', () => {
  const candidate = (url: string, name: string, kind: LogoCandidate['kind']): LogoCandidate => ({
    url,
    name,
    kind,
    format: 'svg',
    source: 'fake',
    sourceId: `fake:${url}`,
  });
  const provider = (found: Error | LogoCandidate[]): LogoProvider => ({
    id: 'fake',
    hosts: ['a.test'],
    search: () => (found instanceof Error ? Promise.reject(found) : Promise.resolve(found)),
  });
  const fetcher = {
    fetch: (url: string): Promise<RemoteIconResult> =>
      Promise.resolve(
        url.includes('missing')
          ? { ok: false as const, message: '404' }
          : { ok: true as const, svg: { viewBox: '0 0 10 10', paths: ['M1 1h8v8H1z'] } },
      ),
  };

  it('ranks by name closeness, then marks first, and drops unimportable logos', async () => {
    const search = createLogoSearch({
      fetcher,
      provider: provider([
        candidate('https://a.test/hashnode.svg', 'Hashnode', 'icon'),
        candidate('https://a.test/word.svg', 'Node.js', 'wordmark'),
        candidate('https://a.test/mark.svg', 'Node.js', 'icon'),
        candidate('https://a.test/missing.svg', 'Node.js', 'icon'),
      ]),
    });
    const result = await search('Node.js');

    expect(result.status).toBe('ok');
    expect(result.results.map((r) => r.url)).toEqual([
      'https://a.test/mark.svg',
      'https://a.test/word.svg',
      'https://a.test/hashnode.svg',
    ]);
  });

  it('reports no-match and unavailable', async () => {
    expect((await createLogoSearch({ fetcher, provider: provider([]) })('Bun')).status).toBe(
      'no-match',
    );
    expect(
      (await createLogoSearch({ fetcher, provider: provider(new Error('down')) })('Bun')).status,
    ).toBe('unavailable');
  });
});
