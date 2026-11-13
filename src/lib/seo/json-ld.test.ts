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
  const [profile, links, technologies, practices, projects] = await Promise.all([
    repository.getProfile('en'),
    repository.getFeaturedLinks('en'),
    repository.getTechnologies('en'),
    repository.getPractices('en'),
    repository.getProjects('en'),
  ]);

  if (!profile) throw new Error('fixture profile missing');

  return graph(
    websiteNode('en'),
    personNode({ locale: 'en', profile, links, technologies, practices }),
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

describe('projectNode', () => {
  it('is a SoftwareApplication only when live', async () => {
    const technologies = await repository.getTechnologies('en');
    const live = await repository.getProject('en', 'orbit-dashboard');
    const notLive = await repository.getProject('en', 'tidy-desk');

    if (live.status !== 'found' || notLive.status !== 'found') {
      throw new Error('fixture projects missing');
    }

    const app = projectNode('en', live.project, technologies);

    expect(app['@type']).toBe('SoftwareApplication');
    expect(app).toMatchObject({ operatingSystem: 'Web' });
    expect(projectNode('en', notLive.project, technologies)['@type']).toBe('CreativeWork');
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
