import { type ProjectKind, projectKinds, type ProjectSummary } from '@/lib/content';

export const PROJECTS_PAGE_SIZE = 12;

export interface ProjectsQuery {
  kind?: ProjectKind;
  page: number;
}

export type ProjectsQueryResult =
  { ok: false; reason: 'kind' | 'page' } | { ok: true; query: ProjectsQuery };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses `?kind=` / `?page=` from the projects index.
 */
export function parseProjectsQuery(search: {
  kind?: string | string[];
  page?: string | string[];
}): ProjectsQueryResult {
  const kindRaw = first(search.kind);
  const pageRaw = first(search.page);

  let kind: ProjectKind | undefined;

  if (kindRaw !== undefined) {
    if (!(projectKinds as readonly string[]).includes(kindRaw)) {
      return { ok: false, reason: 'kind' };
    }

    kind = kindRaw as ProjectKind;
  }

  let page = 1;

  if (pageRaw !== undefined) {
    if (!/^[1-9]\d*$/.test(pageRaw)) return { ok: false, reason: 'page' };

    page = Number(pageRaw);
  }

  return { ok: true, query: { kind, page } };
}

export function filterByKind<T extends { kind: ProjectKind }>(
  projects: readonly T[],
  kind?: ProjectKind,
): T[] {
  return kind ? projects.filter((project) => project.kind === kind) : [...projects];
}

export function kindsWithCounts(projects: readonly ProjectSummary[]): Array<{
  count: number;
  kind: 'automation' | 'desktop' | 'integration' | 'mobile' | 'open-source' | 'web';
}> {
  const counts = new Map<ProjectKind, number>();
  for (const project of projects) {
    counts.set(project.kind, (counts.get(project.kind) ?? 0) + 1);
  }

  return projectKinds
    .map((kind) => ({ kind, count: counts.get(kind) ?? 0 }))
    .filter((entry) => entry.count > 0);
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  size = PROJECTS_PAGE_SIZE,
): { items: T[]; outOfRange: boolean; page: number; total: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const start = (page - 1) * size;

  return {
    page,
    totalPages,
    total: items.length,
    items: items.slice(start, start + size),
    outOfRange: page > totalPages,
  };
}

/**
 * Query string for the index. Omits `page` when it is 1 and `kind` when unset.
 */
export function projectsHref(query: ProjectsQuery): string {
  const params = new URLSearchParams();

  if (query.kind) params.set('kind', query.kind);

  if (query.page > 1) params.set('page', String(query.page));

  const search = params.toString();

  return search ? `/projects?${search}` : '/projects';
}

/**
 * Next-intl `Link` href for the same query (locale prefix is added by Link).
 */
export function projectsLink(query: ProjectsQuery): {
  pathname: '/projects';
  query?: Record<string, string>;
} {
  const next: Record<string, string> = {};

  if (query.kind) next.kind = query.kind;

  if (query.page > 1) next.page = String(query.page);

  return Object.keys(next).length > 0
    ? { pathname: '/projects', query: next }
    : { pathname: '/projects' };
}

/**
 * Up to `limit` other projects, ranked by shared skills then `order`.
 */
export function relatedProjects<
  T extends { id: string; order: number; skillIds: readonly string[] },
>(current: T, all: readonly T[], limit = 3): T[] {
  return all
    .filter((project) => project.id !== current.id)
    .map((project) => ({
      project,
      score: project.skillIds.filter((id) => current.skillIds.includes(id)).length,
    }))
    .sort((left, right) => right.score - left.score || left.project.order - right.project.order)
    .slice(0, limit)
    .map((entry) => entry.project);
}

/**
 * Previous / next by `order`, wrapping.
 */
export function projectNeighbors<T extends { id: string; order: number }>(
  current: T,
  all: readonly T[],
): { next: T; previous: T } | null {
  if (all.length < 2) return null;

  const sorted = [...all].sort((left, right) => left.order - right.order);
  const index = sorted.findIndex((project) => project.id === current.id);

  if (index < 0) return null;

  return {
    previous: sorted[(index - 1 + sorted.length) % sorted.length] as T,
    next: sorted[(index + 1) % sorted.length] as T,
  };
}
