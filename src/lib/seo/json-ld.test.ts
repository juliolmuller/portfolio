import { type Graph } from 'schema-dts';

import { createRepository } from '@/lib/content/create-repository';
import { createFixtureSource } from '@/lib/content/fixtures/source';

import {
  breadcrumbNode,
  graph,
  personNode,
  profilePageNode,
  projectListNode,
  projectNode,
  serializeJsonLd,
  websiteNode,
} from './json-ld';
import { pickDescription, truncate } from './text';
import { SITE_URL } from './urls';

const repository = createRepository(createFixtureSource());

async function homeGraph(): Promise<Graph> {
  const [profile, links, skills, projects] = await Promise.all([
    repository.getProfile('en'),
    repository.getFeaturedLinks('en'),
    repository.getSkills('en'),
    repository.getProjects('en'),
  ]);

  if (!profile) throw new Error('fixture profile missing');

  return graph(
    websiteNode('en'),
    personNode({ locale: 'en', profile, links, skills }),
    profilePageNode('en', profile.updatedAt),
    projectListNode('en', projects, `${SITE_URL}/en#work`),
  );
}

function collectIds(value: unknown, ids: Set<string>, refs: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIds(item, ids, refs));

    return;
  }

  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  const id = record['@id'];

  if (typeof id === 'string') {
    if (Object.keys(record).length === 1) refs.add(id);
    else ids.add(id);
  }

  Object.values(record).forEach((item) => collectIds(item, ids, refs));
}

function collectUrls(value: unknown, out: string[]): void {
  if (typeof value === 'string' && /^(?:\/|https?:)/.test(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectUrls(item, out));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectUrls(item, out));
  }
}

describe('serializeJsonLd', () => {
  it('cannot close the script element', () => {
    const json = serializeJsonLd(
      graph({ '@type': 'Thing', 'name': '</script><script>alert(1)</script>&' }),
    );

    expect(json).not.toMatch(/[<>&]/);
    expect(JSON.parse(json)['@graph'][0].name).toBe('</script><script>alert(1)</script>&');
  });
});

describe('websiteNode', () => {
  it.each(['en', 'pt'] as const)('points url at the %s home with a stable @id', (locale) => {
    const node = websiteNode(locale);

    expect(node.url).toBe(`${SITE_URL}/${locale}`);
    expect(node['@id']).toBe(`${SITE_URL}/#website`);
  });

  it('never uses the redirecting bare root as a URL value', async () => {
    const urls: string[] = [];

    collectUrls(await homeGraph(), urls);
    expect(urls).not.toContain(SITE_URL);
    expect(urls).not.toContain(`${SITE_URL}/`);
  });
});

describe('home graph', () => {
  it('resolves every @id reference', async () => {
    const ids = new Set<string>();
    const refs = new Set<string>();

    collectIds(await homeGraph(), ids, refs);
    expect(refs.size).toBeGreaterThan(0);
    for (const ref of refs) expect(ids).toContain(ref);
  });

  it('uses absolute URLs only', async () => {
    const urls: string[] = [];

    collectUrls(await homeGraph(), urls);
    expect(urls.length).toBeGreaterThan(5);
    for (const url of urls) expect(url).toMatch(/^https?:\/\//);
  });

  it('never includes email, phone or hidden items', async () => {
    const json = JSON.stringify(await homeGraph());

    expect(json).not.toMatch(/hello@example\.com|"email"|"telephone"/);
    expect(json).not.toContain('scratch-pad');
    expect(json).not.toContain('Old notes');
  });

  it('lists own profiles as sameAs', async () => {
    const person = (await homeGraph())['@graph'][1] as Record<string, unknown>;

    expect(person.sameAs).toEqual(['https://example.com/github', 'https://example.com/linkedin']);
  });
});

const knownNames = (person: unknown): string[] => (person as { knowsAbout: string[] }).knowsAbout;

describe('knowsAbout', () => {
  it.each(['en', 'pt'] as const)(
    'equals the former technologies + practices list (%s)',
    async (locale) => {
      const [profile, links, skills, technologies, practices] = await Promise.all([
        repository.getProfile(locale),
        repository.getFeaturedLinks(locale),
        repository.getSkills(locale),
        repository.getTechnologies(locale),
        repository.getPractices(locale),
      ]);

      if (!profile) throw new Error('fixture profile missing');

      const legacy = [...technologies.map((t) => t.name), ...practices.map((p) => p.label)];
      const knowsAbout = knownNames(personNode({ locale, profile, links, skills }));

      // Same names; the order is the skills repository order. Ties in `order`
      // between categories break by id, and skill ids are derived (D93), so
      // tied entries can sit differently than in the technologies list.
      expect(knowsAbout).toEqual(skills.map((skill) => skill.name));
      expect([...knowsAbout].sort()).toEqual([...legacy].sort());
      expect(new Set(legacy).size).toBe(legacy.length);
    },
  );

  it('de-duplicates repeated names, keeping the first position', async () => {
    const profile = await repository.getProfile('en');

    if (!profile) throw new Error('fixture profile missing');

    const knowsAbout = knownNames(
      personNode({
        locale: 'en',
        profile,
        links: [],
        skills: [
          { id: 'a', name: 'TypeScript' },
          { id: 'b', name: 'Testing' },
          { id: 'c', name: 'TypeScript' },
        ],
      }),
    );

    expect(knowsAbout).toEqual(['TypeScript', 'Testing']);
  });
});

describe('projectNode', () => {
  it.each(['en', 'pt'] as const)('keeps the former keywords (%s)', async (locale) => {
    const [skills, technologies, projects] = await Promise.all([
      repository.getSkills(locale),
      repository.getTechnologies(locale),
      repository.getProjects(locale),
    ]);
    const names = new Map(technologies.map((tech) => [tech.id, tech.name]));

    expect(projects.length).toBeGreaterThan(0);

    for (const summary of projects) {
      const found = await repository.getProject(locale, summary.slug);

      if (found.status !== 'found') throw new Error('fixture project missing');

      const legacy = found.project.techIds
        .map((id) => names.get(id))
        .filter(Boolean)
        .join(', ');

      expect(projectNode(locale, found.project, skills)).toMatchObject({ keywords: legacy });
    }
  });

  it('skips unknown skill ids', async () => {
    const skills = await repository.getSkills('en');
    const found = await repository.getProject('en', 'orbit-dashboard');

    if (found.status !== 'found') throw new Error('fixture project missing');

    const base = projectNode('en', found.project, skills);
    const extra = projectNode(
      'en',
      { ...found.project, skillIds: [...found.project.skillIds, 'missing-id'] },
      skills,
    );

    expect(extra).toMatchObject({ keywords: (base as { keywords: string }).keywords });
  });

  it('is a SoftwareApplication only when live', async () => {
    const skills = await repository.getSkills('en');
    const live = await repository.getProject('en', 'orbit-dashboard');
    const notLive = await repository.getProject('en', 'tidy-desk');

    if (live.status !== 'found' || notLive.status !== 'found') {
      throw new Error('fixture projects missing');
    }

    const app = projectNode('en', live.project, skills);

    expect(app['@type']).toBe('SoftwareApplication');
    expect(app).toMatchObject({ operatingSystem: 'Web' });
    expect(projectNode('en', notLive.project, skills)['@type']).toBe('CreativeWork');
  });

  it('builds breadcrumbs with absolute items', () => {
    const crumbs = breadcrumbNode(
      'pt',
      [
        { name: 'Início', path: '' },
        { name: 'Projetos', path: '/projects' },
      ],
      'x',
    );

    expect(crumbs.itemListElement).toEqual([
      expect.objectContaining({ item: `${SITE_URL}/pt` }),
      expect.objectContaining({ item: `${SITE_URL}/pt/projects` }),
    ]);
  });
});

describe('text helpers', () => {
  it('truncates at a word boundary', () => {
    expect(truncate('one two three four', 12)).toBe('one two…');
    expect(truncate('short', 12)).toBe('short');
  });

  it('picks the first description long enough, capped at 160', () => {
    const long = 'word '.repeat(60);

    expect(pickDescription('too short', long).length).toBeLessThanOrEqual(160);
    expect(pickDescription(undefined, 'only short')).toBe('only short');
  });
});
