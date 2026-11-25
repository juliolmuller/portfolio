import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { type Education, type Experience, type Skill } from '@/lib/content';

import { Resume } from './resume';

vi.mock('next-intl/server', () => ({
  getTranslations: async (): Promise<(key: string) => string> => (key) => key,
}));

vi.mock('@/components/motion/timeline-progress', () => ({
  TimelineProgress: ({ children }: { children?: React.ReactNode }): React.JSX.Element => (
    <div>{children}</div>
  ),
}));

vi.mock('./resume-panes', () => ({
  ResumePanes: ({
    experience,
    education,
  }: {
    education: React.ReactNode;
    experience: React.ReactNode;
  }): React.JSX.Element => (
    <div>
      {experience}
      {education}
    </div>
  ),
}));

function entry(id: string, end: string | undefined, collapsedByDefault: boolean): Experience {
  return {
    id,
    company: id,
    roles: [{ title: `Role ${id}`, start: '2020-01', end, summary: 'Short summary.', bullets: [] }],
    techIds: [],
    skillIds: [],
    collapsedByDefault,
    order: 0,
    slug: id,
  } as unknown as Experience;
}

describe('Resume experience initial state (D91)', () => {
  it('follows collapsedByDefault, whatever the dates', async () => {
    const html = renderToStaticMarkup(
      await Resume({
        locale: 'en',
        education: [],
        skills: [],
        links: [],
        resume: null,
        experience: [
          entry('a', undefined, false),
          entry('b', '2023-02', false),
          entry('c', '2022-01', true),
          entry('d', undefined, true),
        ],
      }),
    );
    const jobs = html
      .split('data-timeline-node')
      .slice(1)
      .map((chunk) => /<details[^>]*>/.exec(chunk)?.[0] ?? '');

    expect(jobs).toHaveLength(4);
    expect(jobs.map((tag) => /\sopen[=\s>]/.test(tag))).toEqual([true, true, false, false]);
  });
});

function skill(id: string, name: string): Skill {
  return {
    id,
    name,
    categories: ['frontend'],
    inCloud: false,
    order: 0,
    priority: 2,
  };
}

async function render(experience: Experience, skills: Skill[]): Promise<string> {
  return renderToStaticMarkup(
    await Resume({
      locale: 'en',
      education: [],
      skills,
      links: [],
      resume: null,
      experience: [experience],
    }),
  );
}

function chips(html: string): string[] {
  return [...html.matchAll(/<li><span[^>]*>([^<]*)<\/span><\/li>/g)].map((match) => match[1] ?? '');
}

describe('Resume experience skills (#76)', () => {
  const all = [skill('a', 'Alpha'), skill('b', 'Beta'), skill('c', 'Gamma')];

  it('follows skillIds order, not the skills array order', async () => {
    const html = await render({ ...entry('x', undefined, false), skillIds: ['c', 'a'] }, all);

    expect(chips(html)).toEqual(['Gamma', 'Alpha']);
    expect(html).toContain('<p class="sr-only">skills</p>');
  });

  it('omits ids that are absent from skills', async () => {
    const html = await render({ ...entry('x', undefined, false), skillIds: ['a', 'gone'] }, all);

    expect(chips(html)).toEqual(['Alpha']);
  });

  it('renders no label or list when nothing resolves', async () => {
    const html = await render({ ...entry('x', undefined, false), skillIds: ['gone'] }, all);

    expect(html).not.toContain('sr-only">skills');
    expect(chips(html)).toEqual([]);
  });

  it('ignores techIds', async () => {
    const html = await render(
      { ...entry('x', undefined, false), techIds: ['t'], skillIds: ['a'] },
      [skill('a', 'Alpha'), skill('t', 'Tech')],
    );

    expect(html).not.toContain('Tech');
    expect(chips(html)).toEqual(['Alpha']);
  });
});

function degree(id: string, skillIds: string[]): Education {
  return {
    id,
    kind: 'degree',
    title: `Title ${id}`,
    institution: `School ${id}`,
    start: '2010-01',
    end: '2014-01',
    skillIds,
    order: 0,
    slug: id,
  } as unknown as Education;
}

async function renderEducation(education: Education[], skills: Skill[]): Promise<string> {
  return renderToStaticMarkup(
    await Resume({ locale: 'en', education, skills, links: [], resume: null, experience: [] }),
  );
}

describe('Resume education skills (#77)', () => {
  const all = [skill('a', 'Alpha'), skill('b', 'Beta'), skill('c', 'Gamma')];

  it('follows skillIds order and labels the list', async () => {
    const html = await renderEducation([degree('x', ['c', 'a'])], all);

    expect(chips(html)).toEqual(['Gamma', 'Alpha']);
    expect(html).toContain('<p class="sr-only">skills</p>');
  });

  it('omits ids that are absent from skills', async () => {
    const html = await renderEducation([degree('x', ['a', 'gone'])], all);

    expect(chips(html)).toEqual(['Alpha']);
  });

  it('renders nothing extra without resolvable skills', async () => {
    const html = await renderEducation([degree('x', []), degree('y', ['gone'])], all);

    expect(html).not.toContain('sr-only">skills');
    expect(chips(html)).toEqual([]);
  });

  it('renders one list when only one entry has skills', async () => {
    const html = await renderEducation([degree('x', ['a']), degree('y', [])], all);

    expect(html.split('<ul class="flex flex-wrap gap-2">')).toHaveLength(2);
  });
});
