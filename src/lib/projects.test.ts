import { createRepository } from '@/lib/content/create-repository';
import { createFixtureSource } from '@/lib/content/fixtures/source';

import {
  filterByKind,
  kindsWithCounts,
  paginate,
  parseProjectsQuery,
  projectNeighbors,
  PROJECTS_PAGE_SIZE,
  projectsHref,
  relatedProjects,
} from './projects';

const repository = createRepository(createFixtureSource());

describe('parseProjectsQuery', () => {
  it('defaults to page 1 and no kind', () => {
    expect(parseProjectsQuery({})).toEqual({
      ok: true,
      query: { page: 1 },
    });
  });

  it('rejects unknown kinds and non-positive pages', () => {
    expect(parseProjectsQuery({ kind: 'game' })).toEqual({
      ok: false,
      reason: 'kind',
    });
    expect(parseProjectsQuery({ page: '0' })).toEqual({
      ok: false,
      reason: 'page',
    });
    expect(parseProjectsQuery({ page: '2' })).toEqual({
      ok: true,
      query: { page: 2 },
    });
  });
});

describe('projects listing helpers', () => {
  it('builds crawlable hrefs', () => {
    expect(projectsHref({ page: 1 })).toBe('/projects');
    expect(projectsHref({ kind: 'web', page: 1 })).toBe('/projects?kind=web');
    expect(projectsHref({ kind: 'web', page: 3 })).toBe('/projects?kind=web&page=3');
  });

  it('filters, counts and paginates the fixture set', async () => {
    const projects = await repository.getProjects('en');

    expect(projects.map((project) => project.slug)).not.toContain('scratch-pad');
    expect(filterByKind(projects, 'web').every((p) => p.kind === 'web')).toBe(true);
    expect(kindsWithCounts(projects).map((entry) => entry.kind)).toEqual([
      'web',
      'mobile',
      'desktop',
      'automation',
      'integration',
      'open-source',
    ]);

    const page = paginate(projects, 1);

    expect(page.items).toHaveLength(projects.length);
    expect(page.totalPages).toBe(1);
    expect(page.outOfRange).toBe(false);
    expect(paginate(projects, 2).outOfRange).toBe(true);
    expect(PROJECTS_PAGE_SIZE).toBe(12);
  });
});

describe('relatedProjects and neighbors', () => {
  it('ranks by shared skills and wraps neighbors', async () => {
    const projects = await repository.getProjects('en');
    const orbit = projects.find((project) => project.slug === 'orbit-dashboard');

    if (!orbit) throw new Error('orbit-dashboard missing');

    const related = relatedProjects(orbit, projects, 3);

    expect(related.map((r) => r.slug)).toEqual(['pocket-ledger', 'pay-bridge', 'lint-kit']);

    expect(related).toHaveLength(3);
    expect(related.map((project) => project.slug)).not.toContain('orbit-dashboard');

    const neighbors = projectNeighbors(orbit, projects);

    expect(neighbors?.previous.slug).toBeDefined();
    expect(neighbors?.next.slug).toBeDefined();
    expect(neighbors?.previous.id).not.toBe(orbit.id);
    expect(neighbors?.next.id).not.toBe(orbit.id);
  });
});

describe('relatedProjects ranking', () => {
  const item = (
    id: string,
    order: number,
    skillIds: string[],
    techIds: string[] = [],
  ): { id: string; order: number; skillIds: string[]; techIds: string[] } => ({
    id,
    order,
    skillIds,
    techIds,
  });

  it('follows skillIds, not techIds, with order as tie-break', () => {
    const current = item('a', 0, ['s1', 's2'], ['t1']);
    const all = [
      current,
      item('b', 1, ['s9'], ['t1']),
      item('c', 3, ['s1']),
      item('d', 2, ['s1']),
      item('e', 4, ['s1', 's2']),
    ];

    expect(relatedProjects(current, all).map((p) => p.id)).toEqual(['e', 'd', 'c']);
    expect(relatedProjects(current, all, 2).map((p) => p.id)).toEqual(['e', 'd']);
  });
});
