import 'server-only';

import { type IconifyJSON } from '@iconify/types';
import { type SimpleIcon } from 'simple-icons';

import { type SvgData, type TechnologyDocument } from '../schema';
import { type LinkIcon, type TechIcon } from '../types';
import { monogramFor } from './monogram';
import { svgBodyToPaths } from './svg-geometry';

export type IconSourceUsed =
  'custom-svg' | 'devicon-plain' | 'devicon' | 'monogram' | 'simple-icons';

export interface ResolvedTechIcon {
  /**
   * Simple Icons publishes brand colors; Devicon does not.
   */
  defaultBrandColor?: string;
  icon: TechIcon;
  source: IconSourceUsed;
}

let simpleIconsBySlug: Promise<Map<string, SimpleIcon>> | undefined;
let deviconSets: Promise<IconifyJSON[]> | undefined;

function loadSimpleIcons(): Promise<Map<string, SimpleIcon>> {
  simpleIconsBySlug ??= import('simple-icons').then((module) => {
    const map = new Map<string, SimpleIcon>();
    for (const value of Object.values(module)) {
      if (value && typeof value === 'object' && 'slug' in value) {
        const icon = value as SimpleIcon;

        map.set(icon.slug, icon);
      }
    }

    return map;
  });

  return simpleIconsBySlug;
}

function loadDevicon(): Promise<IconifyJSON[]> {
  deviconSets ??= Promise.all([
    import('@iconify-json/devicon-plain').then((module) => module.icons),
    import('@iconify-json/devicon').then((module) => module.icons),
  ]);

  return deviconSets;
}

/**
 * Every Simple Icons brand, for the admin picker.
 */
export async function simpleIconCatalog(): Promise<Array<{ label: string; slug: string }>> {
  return [...(await loadSimpleIcons()).values()].map((icon) => ({
    slug: icon.slug,
    label: icon.title,
  }));
}

/**
 * Every Devicon name (plain and original sets), for the admin picker.
 */
export async function deviconCatalog(): Promise<Array<{ label: string; slug: string }>> {
  const sets = await loadDevicon();

  return [...new Set(sets.flatMap((set) => Object.keys(set.icons)))]
    .sort()
    .map((slug) => ({ slug, label: slug }));
}

export async function simpleIcon(slug: string): Promise<null | SvgData> {
  const icon = (await loadSimpleIcons()).get(slug);

  return icon ? { viewBox: '0 0 24 24', paths: [icon.path] } : null;
}

function iconifyIcon(set: IconifyJSON, slug: string): null | SvgData {
  const name = set.icons[slug] ? slug : set.aliases?.[slug]?.parent;
  const icon = name ? set.icons[name] : undefined;

  if (!icon) return null;

  const paths = svgBodyToPaths(icon.body);

  if (!paths) return null;

  const left = icon.left ?? set.left ?? 0;
  const top = icon.top ?? set.top ?? 0;
  const width = icon.width ?? set.width ?? 16;
  const height = icon.height ?? set.height ?? 16;

  return { viewBox: `${left} ${top} ${width} ${height}`, paths };
}

/**
 * Logo for a technology: the configured source first, then a monogram. Returns
 * the source actually used so `icons:audit` can report fallbacks.
 */
export async function resolveTechIcon(
  tech: Pick<TechnologyDocument, 'customSvg' | 'iconSlug' | 'iconSource' | 'monogram' | 'name'>,
): Promise<ResolvedTechIcon> {
  const monogram: ResolvedTechIcon = {
    icon: { monogram: tech.monogram ?? monogramFor(tech.name) },
    source: 'monogram',
  };

  switch (tech.iconSource) {
    case 'custom-svg':
      return tech.customSvg ? { icon: tech.customSvg, source: 'custom-svg' } : monogram;
    case 'devicon': {
      if (!tech.iconSlug) return monogram;

      const [plain, original] = await loadDevicon();
      const fromPlain = plain ? iconifyIcon(plain, tech.iconSlug) : null;

      if (fromPlain) return { icon: fromPlain, source: 'devicon-plain' };

      const fromOriginal = original ? iconifyIcon(original, tech.iconSlug) : null;

      if (fromOriginal) return { icon: fromOriginal, source: 'devicon' };

      return monogram;
    }
    case 'monogram':
      return monogram;
    case 'simple-icons': {
      if (!tech.iconSlug) return monogram;

      const icon = (await loadSimpleIcons()).get(tech.iconSlug);

      if (!icon) return monogram;

      return {
        icon: { viewBox: '0 0 24 24', paths: [icon.path] },
        source: 'simple-icons',
        defaultBrandColor: `#${icon.hex}`,
      };
    }
  }
}

/**
 * Single-colour Devicon only: the original set is multi-colour and turns into a
 * solid blob under `currentColor`.
 */
export async function deviconPlainIcon(slug: string): Promise<null | SvgData> {
  const [plain] = await loadDevicon();

  return plain ? iconifyIcon(plain, slug) : null;
}

let deviconPlainNames: Promise<Array<{ label: string; slug: string }>> | undefined;

/**
 * Plain-set Devicon names that actually render, for the link picker.
 */
export function deviconPlainCatalog(): Promise<Array<{ label: string; slug: string }>> {
  deviconPlainNames ??= loadDevicon().then(([plain]) => {
    if (!plain) return [];

    return [...new Set([...Object.keys(plain.icons), ...Object.keys(plain.aliases ?? {})])]
      .filter((slug) => iconifyIcon(plain, slug) !== null)
      .sort()
      .map((slug) => ({ slug, label: slug }));
  });

  return deviconPlainNames;
}

const GENERIC_LINK: LinkIcon = { type: 'lucide', name: 'link' };

/**
 * Like `resolveLinkIcon`, also reporting whether a named icon exists. Lucide
 * names are checked by the admin action (this module stays free of lucide).
 */
export async function resolveLinkIconDetailed(
  icon: string,
): Promise<{ found: boolean; icon: LinkIcon }> {
  if (icon.startsWith('simple-icons:') || icon.startsWith('devicon:')) {
    const isSimple = icon.startsWith('simple-icons:');
    const slug = icon.slice(icon.indexOf(':') + 1);
    const svg = isSimple ? await simpleIcon(slug) : await deviconPlainIcon(slug);

    return svg
      ? { found: true, icon: { type: 'svg', ...svg } }
      : { found: false, icon: GENERIC_LINK };
  }

  if (icon.startsWith('lucide:')) {
    return { found: true, icon: { type: 'lucide', name: icon.slice('lucide:'.length) } };
  }

  return { found: true, icon: GENERIC_LINK };
}

/**
 * `simple-icons:<slug>` / `devicon:<slug>` (plain set) → brand path;
 * `lucide:<name>` and `link` → Lucide.
 */
export async function resolveLinkIcon(icon: string): Promise<LinkIcon> {
  return (await resolveLinkIconDetailed(icon)).icon;
}
