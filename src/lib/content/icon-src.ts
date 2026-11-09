import { type TechIcon } from './types';

/**
 * Technology logos are served as content-addressed files instead of inline
 * paths (D59): inline, every path shipped twice (HTML and RSC payload) and made
 * Home's document ~480 KB larger. Isomorphic: no server-only imports.
 */

export const TECH_ICON_BASE = '/tech-icons';

/**
 * What public client components get: a URL or a monogram, never paths.
 */
export type PublicTechIcon = { monogram: string } | { src: string };

type SvgIcon = Extract<TechIcon, { paths: readonly string[] }>;
type FileIcon = Exclude<TechIcon, { monogram: string }>;

/**
 * Two FNV-1a passes with different seeds: a 64-bit-ish, URL-safe key.
 */
export function iconHash(icon: FileIcon): string {
  // An asset URL is content-addressed by Sanity, so it changes with the image.
  const input =
    'image' in icon ? `image\n${icon.image.url}` : `${icon.viewBox}\n${icon.paths.join('\n')}`;
  const pass = (seed: number): string => {
    let hash = seed;
    for (let index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(36).padStart(7, '0');
  };

  return `${pass(0x811c9dc5)}${pass(0x050c5d1f)}`;
}

export function toPublicIcon(icon: TechIcon): PublicTechIcon {
  if ('monogram' in icon) return { monogram: icon.monogram };

  return { src: `${TECH_ICON_BASE}/${iconHash(icon)}.svg` };
}

const HEX = /^#?([0-9a-f]{6})$/i;

/**
 * The same file filled with one color (the geoid draws them as images).
 */
export function withFill(src: string, color: string): string {
  const match = HEX.exec(color.trim());

  return match?.[1] ? `${src}?fill=${match[1].toLowerCase()}` : src;
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

/**
 * Standalone SVG document; `fill` is six hex digits or black (for masks).
 */
export function renderIconSvg({ viewBox, paths }: SvgIcon, fill?: string): string {
  const color = fill && HEX.test(fill) ? `#${fill.replace('#', '')}` : '#000';
  const body = paths.map((d) => `<path d="${escapeAttribute(d)}"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeAttribute(viewBox)}" fill="${color}">${body}</svg>`;
}

/**
 * A raster logo as its silhouette (D75): the alpha channel, already turned into
 * a grayscale PNG, is a luminance mask over a rect in one color.
 */
export function renderImageIconSvg(
  mask: { base64Png: string; height: number; width: number },
  fill?: string,
): string {
  const color = fill && HEX.test(fill) ? `#${fill.replace('#', '')}` : '#000';
  const { width, height } = mask;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><mask id="m" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse"><image href="data:image/png;base64,${mask.base64Png}" width="${width}" height="${height}"/></mask><rect width="${width}" height="${height}" fill="${color}" mask="url(#m)"/></svg>`;
}
