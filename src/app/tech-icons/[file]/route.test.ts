import { describe, expect, it, vi } from 'vitest';

import { type ContentRepository } from '@/lib/content';
import { iconHash } from '@/lib/content/icon-src';
import { type Skill, type TechIcon, type Technology } from '@/lib/content/types';

import { GET } from './route';

const skillIcon = { viewBox: '0 0 24 24', paths: ['M0 0h24v24H0z'] };
const techIcon = { viewBox: '0 0 16 16', paths: ['M1 1h2'] };
const unknownIcon = { viewBox: '0 0 10 10', paths: ['M2 2h4'] };

/**
 * The route reads nothing but `icon`, so the mocks carry only that field.
 */
const skill = (icon: TechIcon): Skill => ({ icon }) as Skill;
const technology = (icon: TechIcon): Technology => ({ icon }) as Technology;

vi.mock('@/lib/content', () => ({
  getContent: (): Pick<ContentRepository, 'getSkills' | 'getTechnologies'> => ({
    getSkills: () => Promise.resolve([skill(skillIcon), skill({ monogram: 'VB' })]),
    getTechnologies: () => Promise.resolve([technology(techIcon)]),
  }),
}));

function call(file: string, query = ''): Promise<Response> {
  return GET(new Request(`http://localhost/tech-icons/${file}${query}`), {
    params: Promise.resolve({ file }),
  } as RouteContext<'/tech-icons/[file]'>);
}

describe('GET /tech-icons/[file]', () => {
  it('serves a skill-only icon with immutable caching', async () => {
    const response = await call(`${iconHash(skillIcon)}.svg`);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect((await response.text()).startsWith('<svg')).toBe(true);
  });

  it('serves a technology-only icon', async () => {
    expect((await call(`${iconHash(techIcon)}.svg`)).status).toBe(200);
  });

  it('404s for a hash no visible skill or technology owns', async () => {
    expect((await call(`${iconHash(unknownIcon)}.svg`)).status).toBe(404);
  });

  it('validates the file name and the fill', async () => {
    const file = `${iconHash(skillIcon)}.svg`;

    expect((await call('nope.svg')).status).toBe(404);
    expect((await call(file, '?fill=zzz')).status).toBe(404);
    expect(await (await call(file, '?fill=abcdef')).text()).toContain('fill="#abcdef"');
  });
});
