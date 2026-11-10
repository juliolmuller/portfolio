import 'server-only';

import { contentSource } from '@/env';

import { createRepository } from './create-repository';
import { getFixtureDataset } from './fixtures/shared';
import { createFixtureSource } from './fixtures/source';
import { type ContentRepository } from './repository';
import { createSanityHttpFetch } from './sanity/http';
import { createSanitySource } from './sanity/source';

let repository: ContentRepository | undefined;

/**
 * The content repository for the configured source (`CONTENT_SOURCE`).
 */
export function getContent(): ContentRepository {
  repository ??= createRepository(
    contentSource === 'sanity'
      ? createSanitySource(createSanityHttpFetch())
      : createFixtureSource(getFixtureDataset()),
  );

  return repository;
}

/**
 * Home shows featured projects in `order`, capped at six (§8.6).
 */
export const HOME_FEATURED_LIMIT = 6;

export function featuredProjects<T extends { featured: boolean }>(
  projects: readonly T[],
  limit = HOME_FEATURED_LIMIT,
): T[] {
  return projects.filter((project) => project.featured).slice(0, limit);
}

/**
 * `/projects` lists featured projects first, then the rest by `order`.
 */
export function indexOrder<T extends { featured: boolean }>(projects: readonly T[]): T[] {
  return [
    ...projects.filter((project) => project.featured),
    ...projects.filter((project) => !project.featured),
  ];
}

export type { ContentRepository } from './repository';
export {
  type ContentLocale,
  contentLocales,
  type ProjectKind,
  projectKinds,
  type ProjectStatus,
  projectStatuses,
} from './schema';
export { CONTENT_REVALIDATE_SECONDS, contentTags, tagsForDocument } from './tags';
export {
  techCategories,
  type TechCategory,
  type TitleFont,
  titleFontFamily,
  titleFontLabels,
  titleFonts,
} from './taxonomy';
export type * from './types';
