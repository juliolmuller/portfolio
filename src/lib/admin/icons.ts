import 'server-only';

import { icons } from 'lucide-react';

import {
  deviconCatalog,
  deviconPlainCatalog,
  simpleIconCatalog,
} from '@/lib/content/icons/resolve';

export type IconSearchSource = 'devicon-plain' | 'devicon' | 'lucide' | 'simple-icons';
export interface IconHit {
  label: string;
  slug: string;
}

const LIMIT = 24;

const pascal = (name: string): string =>
  name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

export const lucideIconExists = (name: string): boolean => pascal(name) in icons;

const kebab = (pascal: string): string =>
  pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * Prefix matches first, then substring matches, up to 24 hits.
 */
export async function searchIcons(source: IconSearchSource, query: string): Promise<IconHit[]> {
  const needle = query.trim().toLowerCase();

  if (!needle) return [];

  const catalog: IconHit[] =
    source === 'simple-icons'
      ? await simpleIconCatalog()
      : source === 'devicon'
        ? await deviconCatalog()
        : source === 'devicon-plain'
          ? await deviconPlainCatalog()
          : Object.keys(icons).map((name) => ({
              slug: kebab(name),
              label: kebab(name),
            }));
  const hits = catalog.filter(
    (icon) => icon.slug.includes(needle) || icon.label.toLowerCase().includes(needle),
  );

  hits.sort(
    (a, b) =>
      Number(b.slug.startsWith(needle)) - Number(a.slug.startsWith(needle))
      || a.slug.length - b.slug.length,
  );

  return hits.slice(0, LIMIT);
}
