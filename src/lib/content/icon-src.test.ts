import {
  iconHash,
  renderIconSvg,
  renderImageIconSvg,
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

  it('hashes image icons by asset URL and renders them as a mask', () => {
    const image = (url: string): { image: { height: number; url: string; width: number } } => ({
      image: { url, width: 1, height: 1 },
    });

    expect(iconHash(image('https://a/1.png'))).not.toBe(iconHash(image('https://a/2.png')));
    expect(toPublicIcon(image('https://a/1.png'))).toHaveProperty('src');

    const svg = renderImageIconSvg({ base64Png: 'AAAA', width: 4, height: 2 }, 'abcdef');

    expect(svg).toContain('viewBox="0 0 4 2"');
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
    expect(svg).toContain('fill="#abcdef" mask="url(#m)"');
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
