import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { type Experience } from '@/lib/content';

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
  ResumePanes: ({ experience }: { experience: React.ReactNode }): React.JSX.Element => (
    <div>{experience}</div>
  ),
}));

function entry(id: string, end: string | undefined, collapsedByDefault: boolean): Experience {
  return {
    id,
    company: id,
    roles: [{ title: `Role ${id}`, start: '2020-01', end, summary: 'Short summary.', bullets: [] }],
    techIds: [],
    collapsedByDefault,
    order: 0,
    slug: id,
  } as unknown as Experience;
}

describe('Resume experience initial state (D89)', () => {
  it('follows collapsedByDefault, whatever the dates', async () => {
    const html = renderToStaticMarkup(
      await Resume({
        locale: 'en',
        education: [],
        technologies: [],
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
