import 'server-only';

import {
  type BreadcrumbList,
  type CollectionPage,
  type CreativeWork,
  type Graph,
  type ItemList,
  type Person,
  type ProfilePage,
  type SoftwareApplication,
  type Thing,
  type WebSite,
} from 'schema-dts';

import { owner } from '@/config/site';
import { type AppLocale, localeTags } from '@/i18n/routing';
import {
  type FeaturedLink,
  type Practice,
  type Profile,
  type Project,
  type ProjectSummary,
  type Technology,
} from '@/lib/content';

import { plainText } from './text';
import { absoluteUrl, localizedPath, PERSON_ID, WEBSITE_ID } from './urls';

/**
 * JSON for a `<script type="application/ld+json">`. Escapes `<`, `>`, `&` and
 * the JS line separators so content can never close the script element.
 */
export function serializeJsonLd(data: Graph): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function graph(...nodes: Thing[]): Graph {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

const ref = (id: string): { '@id': string } => ({ '@id': id });

interface PersonInput {
  links: FeaturedLink[];
  locale: AppLocale;
  practices: Practice[];
  profile: Profile;
  technologies: Technology[];
}

export function personNode({
  locale,
  profile,
  links,
  technologies,
  practices,
}: PersonInput): Person {
  const firstParagraph = profile.bio.split(/\n{2,}/)[0] ?? profile.bio;

  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    'name': profile.displayName,
    'givenName': owner.givenName,
    'familyName': owner.familyName,
    'jobTitle': profile.jobTitle,
    'description': plainText(firstParagraph),
    'url': absoluteUrl(localizedPath(locale)),
    ...(profile.photo ? { image: absoluteUrl(profile.photo.url) } : {}),
    'sameAs': links
      .filter((link) => link.isOwnProfile && link.url.startsWith('https:'))
      .map((link) => link.url),
    'knowsAbout': [
      ...technologies.map((tech) => tech.name),
      ...practices.map((practice) => practice.label),
    ],
    'knowsLanguage': profile.spokenLanguages,
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': owner.city,
      'addressCountry': owner.countryCode,
    },
  };
}

/**
 * `url` is the locale home because the bare root redirects (D88); the `@id`
 * stays the same in both locales so the graph is stable.
 */
export function websiteNode(locale: AppLocale): WebSite {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    'name': owner.name,
    'url': absoluteUrl(localizedPath(locale)),
    'inLanguage': Object.values(localeTags),
    'publisher': ref(PERSON_ID),
  };
}

export function profilePageNode(locale: AppLocale, dateModified: string): ProfilePage {
  const url = absoluteUrl(localizedPath(locale));

  return {
    '@type': 'ProfilePage',
    '@id': `${url}#page`,
    url,
    'name': owner.name,
    'inLanguage': localeTags[locale],
    'isPartOf': ref(WEBSITE_ID),
    'mainEntity': ref(PERSON_ID),
    dateModified,
  };
}

export function projectUrl(locale: AppLocale, slug: string): string {
  return absoluteUrl(localizedPath(locale, `/projects/${slug}`));
}

export function projectListNode(
  locale: AppLocale,
  projects: readonly ProjectSummary[],
  id: string,
  offset = 0,
): ItemList {
  return {
    '@type': 'ItemList',
    '@id': id,
    'numberOfItems': projects.length,
    'itemListElement': projects.map((project, index) => ({
      '@type': 'ListItem',
      'position': offset + index + 1,
      'url': projectUrl(locale, project.slug),
      'name': project.title,
    })),
  };
}

export interface Crumb {
  name: string;
  /**
   * Locale-independent path.
   */
  path: string;
}

export function breadcrumbNode(
  locale: AppLocale,
  crumbs: readonly Crumb[],
  id: string,
): BreadcrumbList {
  return {
    '@type': 'BreadcrumbList',
    '@id': id,
    'itemListElement': crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': crumb.name,
      'item': absoluteUrl(localizedPath(locale, crumb.path)),
    })),
  };
}

export function collectionPageNode(
  locale: AppLocale,
  path: string,
  name: string,
  description: string,
  parts: { breadcrumbId: string; listId: string },
): CollectionPage {
  const url = absoluteUrl(localizedPath(locale, path));

  return {
    '@type': 'CollectionPage',
    '@id': `${url}#page`,
    url,
    name,
    description,
    'inLanguage': localeTags[locale],
    'isPartOf': ref(WEBSITE_ID),
    'author': ref(PERSON_ID),
    'breadcrumb': ref(parts.breadcrumbId),
    'mainEntity': ref(parts.listId),
  };
}

export function projectNode(
  locale: AppLocale,
  project: Project,
  technologies: readonly Technology[],
): CreativeWork | SoftwareApplication {
  const url = projectUrl(locale, project.slug);
  const names = new Map(technologies.map((tech) => [tech.id, tech.name]));
  const base = {
    '@id': `${url}#work`,
    'name': project.title,
    'headline': project.tagline,
    'description': project.summary,
    url,
    ...(project.cover ? { image: absoluteUrl(project.cover.url) } : {}),
    'author': ref(PERSON_ID),
    'creator': ref(PERSON_ID),
    'dateModified': project.updatedAt,
    'inLanguage': localeTags[locale],
    'keywords': project.techIds
      .map((id) => names.get(id))
      .filter((name): name is string => Boolean(name))
      .join(', '),
  };

  if (project.links.live) {
    return {
      '@type': 'SoftwareApplication',
      ...base,
      'applicationCategory':
        project.kind === 'open-source' ? 'DeveloperApplication' : 'BusinessApplication',
      'operatingSystem': 'Web',
      'sameAs': project.links.live,
    };
  }

  return { '@type': 'CreativeWork', ...base };
}
