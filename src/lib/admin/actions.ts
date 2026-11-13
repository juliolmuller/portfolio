'use server';

import { requireAdmin } from '@/lib/auth/session';
import { type LinkIcon, type TechIcon } from '@/lib/content';
import {
  type DeleteOutcome,
  type FlagOutcome,
  type SaveOutcome,
} from '@/lib/content/admin/service';
import { resolveLinkIconDetailed, resolveTechIcon } from '@/lib/content/icons/resolve';
import { type DocumentType, documentTypes } from '@/lib/content/schema';

import { revalidateEverything } from './hooks';
import { type IconHit, type IconSearchSource, lucideIconExists, searchIcons } from './icons';
import { getAdminService } from './service';
import { sanitizeSvg, type SvgResult } from './upload/svg';

function asType(type: string): DocumentType {
  if (!(documentTypes as string[]).includes(type)) throw new Error('Unknown type');

  return type as DocumentType;
}

export async function saveDocumentAction(
  type: string,
  id: null | string,
  values: unknown,
  rev?: string,
): Promise<SaveOutcome> {
  await requireAdmin();

  return getAdminService().save(asType(type), id, values, rev);
}

export async function deleteDocumentAction(
  type: string,
  id: string,
  rev?: string,
): Promise<DeleteOutcome> {
  await requireAdmin();

  return getAdminService().remove(asType(type), id, rev);
}

export async function setFlagAction(
  type: string,
  id: string,
  field: 'featured' | 'visible',
  value: boolean,
  rev?: string,
): Promise<FlagOutcome> {
  await requireAdmin();

  if (field !== 'visible' && field !== 'featured') throw new Error('Bad field');

  return getAdminService().setFlag(asType(type), id, field, Boolean(value), rev);
}

export async function reorderAction(type: string, ids: string[]): Promise<FlagOutcome> {
  await requireAdmin();

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new Error('Bad ids');
  }

  return getAdminService().reorder(asType(type), ids);
}

export async function revalidateAllAction(): Promise<{ ok: true }> {
  await requireAdmin();
  revalidateEverything();

  return { ok: true };
}

export async function parseSvgAction(source: string): Promise<SvgResult> {
  await requireAdmin();

  return sanitizeSvg(String(source).slice(0, 100_000));
}

const SEARCH_SOURCES = new Set<string>(['devicon', 'devicon-plain', 'lucide', 'simple-icons']);

export async function searchIconsAction(
  source: IconSearchSource,
  query: string,
): Promise<IconHit[]> {
  await requireAdmin();

  if (!SEARCH_SOURCES.has(source)) return [];

  return searchIcons(source, String(query).slice(0, 64));
}

export async function previewTechIconAction(input: {
  customSvg?: { paths: string[]; viewBox: string };
  iconSlug?: string;
  iconSource: 'custom-svg' | 'devicon' | 'monogram' | 'simple-icons';
  monogram?: string;
  name: string;
}): Promise<{ brandColor?: string; icon: TechIcon }> {
  await requireAdmin();

  const resolved = await resolveTechIcon(input);

  return {
    icon: resolved.icon,
    ...(resolved.defaultBrandColor ? { brandColor: resolved.defaultBrandColor } : {}),
  };
}

export async function previewLinkIconAction(
  icon: string,
): Promise<{ found: boolean; icon: LinkIcon }> {
  await requireAdmin();

  const value = String(icon).slice(0, 80);
  const result = await resolveLinkIconDetailed(value);

  return value.startsWith('lucide:')
    ? { ...result, found: lucideIconExists(value.slice('lucide:'.length)) }
    : result;
}
