import 'server-only';

import { createTranslator } from 'next-intl';

import { owner } from '@/config/site';
import { type AppLocale, routing } from '@/i18n/routing';
import { absoluteUrl, localizedPath } from '@/lib/seo/urls';

import en from '../../../messages/en.json';
import pt from '../../../messages/pt.json';

export interface LlmsSection {
  heading: string;
  links: Array<{ description: string; label: string; path: string }>;
  locale: AppLocale;
  summary: string;
}

interface LlmsInput {
  absolute: (path: string) => string;
  intro: string;
  name: string;
  sections: LlmsSection[];
  summary: string;
}

/**
 * Pure Markdown builder: one H1, a blockquote summary, then one section per
 * locale. LF endings, single trailing newline, no runs of blank lines.
 */
export function buildLlmsTxt({ name, summary, intro, sections, absolute }: LlmsInput): string {
  const blocks = [`# ${name}`, `> ${summary}`, intro];

  sections.forEach((section, index) => {
    blocks.push(`## ${section.heading}`);

    // The default locale's summary is already the blockquote above.
    if (index > 0) blocks.push(section.summary);

    blocks.push(
      section.links
        .map((link) => `- [${link.label}](${absolute(link.path)}): ${link.description}`)
        .join('\n'),
    );
  });

  return `${blocks.join('\n\n')}\n`;
}

const catalogs = { en, pt } satisfies Record<AppLocale, unknown>;

const PAGES = [
  { path: '/', key: 'home' },
  { path: '/projects', key: 'projects' },
  { path: '/accessibility', key: 'accessibility' },
] as const;

/**
 * Built from `src/config/site.ts` and the message catalogs only: no repository
 * content, so hidden items and contact details can't reach it.
 */
export function renderLlmsTxt(): string {
  const locales = [
    routing.defaultLocale,
    ...routing.locales.filter((locale) => locale !== routing.defaultLocale),
  ];
  const sections = locales.map((locale): LlmsSection => {
    const messages = catalogs[locale];
    const t = createTranslator({ locale, messages, namespace: 'llms' });
    const meta = createTranslator({ locale, messages, namespace: 'meta' });

    return {
      locale,
      heading: t('heading'),
      summary: meta('siteDescription', {
        name: owner.name,
        jobTitle: owner.jobTitle,
        city: `${owner.city}, ${owner.country}`,
      }),
      links: PAGES.map(({ path, key }) => ({
        label: t(key),
        description: t(`${key}Description`),
        path: localizedPath(locale, path),
      })),
    };
  });
  const intro = createTranslator({
    locale: routing.defaultLocale,
    messages: catalogs[routing.defaultLocale],
    namespace: 'llms',
  })('intro');

  return buildLlmsTxt({
    name: owner.name,
    summary: sections[0]?.summary ?? '',
    intro,
    sections,
    absolute: absoluteUrl,
  });
}
