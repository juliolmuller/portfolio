import { monogramFor } from './monogram';
import {
  deviconPlainCatalog,
  deviconPlainIcon,
  resolveLinkIcon,
  resolveLinkIconDetailed,
  resolveTechIcon,
} from './resolve';
import { svgBodyToPaths } from './svg-geometry';

describe('svgBodyToPaths', () => {
  it('keeps paths and converts basic shapes', () => {
    expect(
      svgBodyToPaths(
        '<path d="M0 0h10v10z" fill="currentColor"/><circle cx="5" cy="5" r="2"/><rect x="1" y="2" width="3" height="4"/><polygon points="0,0 4,0 2,3"/>',
      ),
    ).toEqual([
      'M0 0h10v10z',
      'M3 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0Z',
      'M1 2h3v4h-3Z',
      'M0 0L4 0L2 3Z',
    ]);
  });

  it('skips unfilled shapes', () => {
    expect(svgBodyToPaths('<path d="M0 0h1" fill="none"/><path d="M1 1h1"/>')).toEqual(['M1 1h1']);
  });

  it.each([
    '<g transform="scale(2)"><path d="M0 0"/></g>',
    '<path d="M0 0" transform="rotate(4)"/>',
    '<defs><linearGradient id="a"/></defs><path d="M0 0"/>',
    '<path d="M0 0" stroke="#000"/>',
    '<rect x="0" y="0" width="1" height="1" rx="1"/>',
    '',
  ])('rejects what it cannot render faithfully: %s', (body) => {
    expect(svgBodyToPaths(body)).toBeNull();
  });
});

describe('monogramFor', () => {
  it.each([
    ['SQL', 'SQL'],
    ['VBA', 'VBA'],
    ['SharePoint', 'SP'],
    ['Power BI', 'PB'],
    ['Excel / Power Query', 'EP'],
    ['Kotlin', 'KO'],
    ['', '?'],
  ])('%s → %s', (name, expected) => {
    expect(monogramFor(name)).toBe(expected);
  });
});

describe('resolveTechIcon', () => {
  it('uses Simple Icons with its brand color', async () => {
    const resolved = await resolveTechIcon({
      name: 'React',
      iconSource: 'simple-icons',
      iconSlug: 'react',
    });

    expect(resolved.source).toBe('simple-icons');
    expect(resolved.defaultBrandColor).toBe('#61DAFB');
    expect(resolved.icon).toMatchObject({ viewBox: '0 0 24 24' });
  });

  it('prefers the single-tone Devicon set', async () => {
    const resolved = await resolveTechIcon({
      name: 'Java',
      iconSource: 'devicon',
      iconSlug: 'java',
    });

    expect(resolved.source).toBe('devicon-plain');
    expect(resolved.icon).toMatchObject({ viewBox: '0 0 128 128' });
  });

  it('resolves VBA through Devicon visualbasic (D37)', async () => {
    const resolved = await resolveTechIcon({
      name: 'VBA',
      iconSource: 'devicon',
      iconSlug: 'visualbasic',
    });

    expect(resolved.source).toBe('devicon-plain');
    expect(resolved.icon).toMatchObject({ viewBox: '0 0 128 128' });
  });

  it('falls back to a monogram for unknown slugs', async () => {
    expect(
      await resolveTechIcon({
        name: 'Made Up',
        iconSource: 'simple-icons',
        iconSlug: 'not-a-real-icon',
      }),
    ).toEqual({ icon: { monogram: 'MU' }, source: 'monogram' });
  });

  it('honors a monogram override', async () => {
    expect(
      (
        await resolveTechIcon({
          name: 'Power BI',
          iconSource: 'monogram',
          monogram: 'BI',
        })
      ).icon,
    ).toEqual({ monogram: 'BI' });
  });
});

describe('resolveLinkIcon', () => {
  it('maps brand, Lucide and generic icons', async () => {
    expect((await resolveLinkIcon('simple-icons:github')).type).toBe('svg');
    expect(await resolveLinkIcon('lucide:rss')).toEqual({
      type: 'lucide',
      name: 'rss',
    });
    expect(await resolveLinkIcon('link')).toEqual({
      type: 'lucide',
      name: 'link',
    });
    expect(await resolveLinkIcon('simple-icons:nope')).toEqual({
      type: 'lucide',
      name: 'link',
    });
  });
});

describe('devicon link icons (plain set only)', () => {
  it('resolves devicon:linkedin to a real mark', async () => {
    const icon = await resolveLinkIcon('devicon:linkedin');

    if (icon.type !== 'svg') throw new Error('expected svg');

    expect(icon.viewBox).not.toBe('');
    expect(icon.paths.length).toBeGreaterThan(0);
  });

  it('falls back to the generic link for an unknown slug', async () => {
    expect(await resolveLinkIcon('devicon:nope-x')).toEqual({ type: 'lucide', name: 'link' });
  });

  it('never resolves a name that only exists in the original set', async () => {
    const plain = new Set((await deviconPlainCatalog()).map((hit) => hit.slug));
    const original = (await import('@iconify-json/devicon')).icons;
    const only = Object.keys(original.icons).find((slug) => !plain.has(slug));

    expect(only).toBeDefined();
    expect(await deviconPlainIcon(only ?? '')).toBeNull();
    expect(await resolveLinkIcon(`devicon:${only}`)).toEqual({ type: 'lucide', name: 'link' });
  });

  it('reports whether a named icon exists', async () => {
    expect((await resolveLinkIconDetailed('devicon:linkedin')).found).toBe(true);
    expect((await resolveLinkIconDetailed('devicon:nope-x')).found).toBe(false);
    expect((await resolveLinkIconDetailed('simple-icons:github')).found).toBe(true);
    expect((await resolveLinkIconDetailed('simple-icons:nope-x')).found).toBe(false);
    expect((await resolveLinkIconDetailed('link')).found).toBe(true);
  });
});
