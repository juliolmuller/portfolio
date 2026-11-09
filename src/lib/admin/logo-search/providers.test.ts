import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { rasterizeSvg, toLogoImage } from '@/lib/admin/upload/image';

import { createAggregateLogoProvider } from './aggregate';
import { type FetchJson, type LogoCandidate, type LogoProvider } from './provider';
import { createIconifyProvider } from './providers/iconify';
import { createLogoDevProvider } from './providers/logo-dev';
import { createSvglProvider } from './providers/svgl';
import { createWorldvectorlogoProvider } from './providers/worldvectorlogo';
import { closeness, searchTerms } from './terms';

describe('searchTerms', () => {
  it.each([
    ['Node.js', ['node.js', 'nodejs', 'node', 'node js']],
    ['Node', ['node']],
    ['NodeJS', ['nodejs', 'node']],
    ['node js', ['node js', 'nodejs', 'node']],
    ['claude', ['claude']],
    ['Claude AI', ['claude ai', 'claudeai', 'claude']],
    ['Next.js', ['next.js', 'nextjs', 'next', 'next js']],
    ['React', ['react']],
    ['GitHub', ['github']],
    ['Café', ['cafe']],
  ])('%s', (query, terms) => expect(searchTerms(query)).toEqual(terms));

  it('ranks exact, prefix, contains, other', () => {
    expect(closeness('Node.js', 'nodejs')).toBe(0);
    expect(closeness('Node.js', 'Node')).toBe(1);
    expect(closeness('Hashnode', 'node')).toBe(2);
    expect(closeness('React', 'node')).toBe(3);
  });
});

/**
 * Answers by URL substring; records every URL asked for.
 */
function fakeJson(answers: Record<string, unknown>): { urls: string[] } & FetchJson {
  const urls: string[] = [];
  const fn = (async (url, schema, options) => {
    urls.push(url);

    const key = Object.keys(answers).find((part) => url.includes(`${part}&`) || url.endsWith(part));

    if (key === undefined) {
      if (options?.notFoundAs !== undefined) return options.notFoundAs;

      throw new Error('HTTP 404');
    }

    return schema.parse(answers[key]);
  }) as FetchJson;

  return Object.assign(fn, { urls });
}

describe('svgl', () => {
  it('reads both route shapes and wordmarks; a 404 is empty', async () => {
    const fetchJson = fakeJson({
      'search=node.js': [
        { id: 446, title: 'Node.js', category: 'Library', route: 'https://svgl.app/n.svg' },
      ],
      'search=node': [
        {
          id: 45,
          title: 'React',
          route: { light: 'https://svgl.app/rl.svg', dark: 'https://svgl.app/rd.svg' },
          wordmark: 'https://svgl.app/rw.svg',
        },
      ],
    });
    const found = await createSvglProvider({ fetchJson }).search('Node.js');

    expect(fetchJson.urls).toHaveLength(3);
    expect(found.map((c) => [c.url, c.kind, c.theme])).toEqual([
      ['https://svgl.app/n.svg', 'icon', undefined],
      ['https://svgl.app/rd.svg', 'icon', 'dark'],
      ['https://svgl.app/rl.svg', 'icon', 'light'],
      ['https://svgl.app/rw.svg', 'wordmark', undefined],
    ]);
  });
});

describe('iconify', () => {
  it('builds file URLs and spots wordmarks', async () => {
    const fetchJson = fakeJson({
      'query=nodejs': { icons: ['logos:nodejs-icon', 'logos:nodejs-wordmark', 'bad'] },
      'query=node': { icons: ['logos:nodejs-icon'] },
    });
    const found = await createIconifyProvider({ fetchJson }).search('NodeJS');

    expect(found.map((c) => [c.url, c.kind])).toEqual([
      ['https://api.iconify.design/logos/nodejs-icon.svg', 'icon'],
      ['https://api.iconify.design/logos/nodejs-wordmark.svg', 'wordmark'],
    ]);
  });
});

describe('worldvectorlogo', () => {
  it('spends one request on the typed name and sends the key', async () => {
    const answer = {
      data: [{ slug: 'nodejs', name: 'NodeJS', svg_url: 'https://cdn.worldvectorlogo.com/n.svg' }],
    };
    const fetchJson = vi.fn((_url: string, schema: { parse: (v: unknown) => unknown }) =>
      Promise.resolve(schema.parse(answer)),
    );
    const found = await createWorldvectorlogoProvider({
      fetchJson: fetchJson as FetchJson,
      apiKey: 'k',
    }).search('Node.js');

    expect(fetchJson).toHaveBeenCalledOnce();
    expect(fetchJson).toHaveBeenCalledWith(
      'https://worldvectorlogo.com/api/v1/logos/search?q=Node.js',
      expect.anything(),
      { headers: { Authorization: 'Bearer k' } },
    );
    expect(found[0]).toMatchObject({
      kind: 'unknown',
      url: 'https://cdn.worldvectorlogo.com/n.svg',
    });
  });
});

describe('logo.dev', () => {
  it('encodes the name and marks results as raster', async () => {
    const found = await createLogoDevProvider({ publishableKey: 'pk_x' }).search('AT&T');

    expect(found).toHaveLength(2);
    expect(found[0]?.url).toContain('/name/AT%26T?token=pk_x');
    expect(found[0]?.format).toBe('raster');
  });
});

describe('createAggregateLogoProvider', () => {
  const ok = (id: string, urls: string[]): LogoProvider => ({
    id,
    hosts: [`${id}.test`],
    search: () =>
      Promise.resolve(
        urls.map((url): LogoCandidate => ({
          url,
          name: id,
          source: id,
          sourceId: url,
          kind: 'icon',
          format: 'svg',
        })),
      ),
  });
  const down = (id: string): LogoProvider => ({
    id,
    hosts: [],
    search: () => Promise.reject(new Error('down')),
  });

  it('merges what resolves, ignores failures and duplicates', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const aggregate = createAggregateLogoProvider([
      ok('a', ['https://x/1', 'https://x/2']),
      down('b'),
      ok('c', ['https://x/2', 'https://x/3']),
    ]);

    expect((await aggregate.search('q')).map((c) => c.url)).toEqual([
      'https://x/1',
      'https://x/2',
      'https://x/3',
    ]);
    expect(aggregate.hosts).toEqual(['a.test', 'c.test']);
    expect(warn).toHaveBeenCalledWith('[logo-search] b failed');
    warn.mockRestore();
  });

  it('fails only when every provider fails, or there are none', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(createAggregateLogoProvider([down('a'), down('b')]).search('q')).rejects.toThrow(
      AggregateError,
    );
    await expect(createAggregateLogoProvider([]).search('q')).rejects.toThrow(AggregateError);
    await expect(
      createAggregateLogoProvider([down('a'), ok('b', [])]).search('q'),
    ).resolves.toEqual([]);
    warn.mockRestore();
  });
});

describe('toLogoImage', () => {
  const make = (alpha: boolean): Promise<Buffer> =>
    sharp({
      create: {
        width: 600,
        height: 300,
        channels: alpha ? 4 : 3,
        background: alpha ? { r: 0, g: 0, b: 0, alpha: 0.5 } : { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

  it('shrinks transparent logos to WebP and refuses opaque ones', async () => {
    expect(await toLogoImage(await make(true))).toMatchObject({
      dataUrl: expect.stringMatching(/^data:image\/webp;base64,/),
      width: 256,
      height: 128,
    });
    expect(await toLogoImage(await make(false))).toEqual({
      message: 'That logo has no transparency',
    });
  });
});

describe('rasterizeSvg', () => {
  it('draws SVGs the path sanitizer refuses, but never external references', async () => {
    const evenOdd =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill-rule="evenodd" d="M0 0h10v10H0zM2 2h6v6H2z"/></svg>';

    expect(await rasterizeSvg(evenOdd)).toBeInstanceOf(Buffer);

    for (const bad of [
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///etc/passwd"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><image xlink:href="https://evil.test/x.png"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://evil.test/x)"/></svg>',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
    ]) {
      expect(await rasterizeSvg(bad)).toBeNull();
    }
  });
});

describe('rasterizeSvg references', () => {
  it('allows quoted fragment references', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><defs><linearGradient id="a"><stop offset="0" stop-color="#000"/></linearGradient><path id="b" d="M0 0h10v10H0z"/></defs><mask id="m"><use xlink:href="#b" fill="#fff"/></mask><path fill="url(#a)" mask="url(#m)" d="M0 0h10v10H0z"/></svg>';

    expect(await rasterizeSvg(svg)).toBeInstanceOf(Buffer);
  });
});
