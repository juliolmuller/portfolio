import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { type ProjectSummary } from '@/lib/content';

import { ProjectCard } from './project-card';

const t = (key: string, values?: Record<string, string>): string => {
  const table: Record<string, string> = {
    'visitApp': 'Visit app',
    'visitAppLabel': `Visit app: ${values?.title ?? ''} (opens in a new tab)`,
    'viewDetails': 'View details',
    'viewDetailsLabel': `View details about ${values?.title ?? ''}`,
    'moreTechnologies': 'more',
    'kinds.web': 'Web',
    'statuses.live': 'Live',
  };

  return table[key] ?? key;
};

vi.mock('next-intl/server', () => ({
  getTranslations: async (): Promise<(key: string, values?: Record<string, string>) => string> => t,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    children?: unknown;
    href: { pathname?: string } | string;
  }): React.JSX.Element => (
    <a href={typeof href === 'string' ? href : (href.pathname ?? '/')} {...props}>
      {children as never}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>): React.JSX.Element => (
    // Test stub; next/image is not available under Vitest.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" {...props} />
  ),
}));

const base: ProjectSummary = {
  id: 'project.test',
  slug: 'test-app',
  previousSlugs: [],
  featured: true,
  visible: true,
  order: 1,
  year: 2026,
  kind: 'web',
  status: 'live',
  techIds: [],
  skillIds: [],
  links: {},
  title: 'Test App',
  tagline: 'A tagline',
  summary: 'A summary long enough to describe the project on a card.',
  role: 'Engineer',
  context: 'Context',
  approach: 'Approach',
  highlights: ['One', 'Two', 'Three'],
  updatedAt: '2026-10-01T12:00:00Z',
};

async function markup(project: ProjectSummary): Promise<string> {
  return renderToStaticMarkup(await ProjectCard({ project, techNames: ['React'] }));
}

describe('ProjectCard CTAs', () => {
  it('renders Visit app + View details when a live URL exists', async () => {
    const html = await markup({
      ...base,
      links: { live: 'https://example.com/app' },
    });

    expect(html).toContain('Visit app: Test App (opens in a new tab)');
    expect(html).toContain('View details about Test App');
    expect(html).toContain('https://example.com/app');
    expect(html).toContain('noopener noreferrer');
    expect(html).toContain('test-app');
  });

  it('makes View details the only CTA when there is no live URL', async () => {
    const html = await markup(base);

    expect(html).not.toContain('Visit app');
    expect(html).toContain('View details about Test App');
    expect(html).toContain('bg-text-1');
  });
});
