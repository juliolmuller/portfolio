import {
  findIconByHash,
  iconHash,
  renderIconSvg,
  TECH_ICON_BASE,
  toPublicIcon,
  withFill,
} from './icon-src';

const icon = { viewBox: '0 0 24 24', paths: ['M0 0h24v24H0z', 'M1 1h2'] };

describe('icon-src', () => {
  it('hashes deterministically and changes with the paths', () => {
    expect(iconHash(icon)).toBe(iconHash({ ...icon }));
    expect(iconHash(icon)).toMatch(/^[0-9a-z]{14}$/);
    expect(iconHash({ ...icon, paths: ['M0 0h1'] })).not.toBe(iconHash(icon));
    expect(iconHash({ ...icon, viewBox: '0 0 16 16' })).not.toBe(iconHash(icon));
  });

  it('turns paths into a URL and keeps monograms', () => {
    expect(toPublicIcon(icon)).toEqual({
      src: `${TECH_ICON_BASE}/${iconHash(icon)}.svg`,
    });
    expect(toPublicIcon({ monogram: 'VB' })).toEqual({ monogram: 'VB' });
  });

  it('adds only valid hex fills', () => {
    expect(withFill('/tech-icons/x.svg', '#AABBCC')).toBe('/tech-icons/x.svg?fill=aabbcc');
    expect(withFill('/tech-icons/x.svg', 'red')).toBe('/tech-icons/x.svg');
  });

  it('renders an escaped standalone SVG', () => {
    const svg = renderIconSvg({ viewBox: '0 0 1 1', paths: ['M0"<0'] }, 'abcdef');

    expect(svg).toContain('fill="#abcdef"');
    expect(svg).toContain('d="M0&quot;&lt;0"');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(renderIconSvg(icon, 'zzz')).toContain('fill="#000"');
  });
});

describe('findIconByHash', () => {
  const other = { viewBox: '0 0 8 8', paths: ['M0 0h8'] };

  it('finds an SVG icon by its hash', () => {
    expect(findIconByHash([other, icon], iconHash(icon))).toBe(icon);
  });

  it('ignores monograms and missing icons', () => {
    expect(findIconByHash([{ monogram: 'VB' }, undefined], iconHash(icon))).toBeUndefined();
  });

  it('returns undefined for unknown hashes and empty lists', () => {
    expect(findIconByHash([other], iconHash(icon))).toBeUndefined();
    expect(findIconByHash([], iconHash(icon))).toBeUndefined();
  });
});
