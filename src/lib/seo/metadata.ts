import 'server-only';

import { type Metadata } from 'next';

import { owner } from '@/config/site';
import { env, isIndexable } from '@/env';
import { type AppLocale, ogLocales, routing } from '@/i18n/routing';

import { TITLE_MAX, truncate } from './text';
import { absoluteUrl, languageAlternates, localizedPath } from './urls';

interface PageMetadataInput {
  absoluteTitle?: string;
  /**
   * Canonical override (filtered listings point at the unfiltered page).
   */
  canonicalPath?: string;
  description: string;
  locale: AppLocale;
  modifiedTime?: string;
  /**
   * `noindex, follow` (filtered listings).
   */
  noindex?: boolean;
  /**
   * Locale-independent path, e.g. `/projects/orbit-dashboard`.
   */
  path: string;
  /**
   * Combined with the `%s | name` template unless `absoluteTitle` is set.
   */
  title?: string;
  type?: 'article' | 'profile' | 'website';
}

const TEMPLATE_SUFFIX = ` | ${owner.name}`;

function fitTitle(title: string, withTemplate: boolean): string {
  const budget = TITLE_MAX - (withTemplate ? TEMPLATE_SUFFIX.length : 0);

  return truncate(title, budget);
}

export function robotsFor(noindex = false): Metadata['robots'] {
  if (!isIndexable) return { index: false, follow: false };

  if (noindex) return { index: false, follow: true };

  return {
    index: true,
    follow: true,
    googleBot: {
      'index': true,
      'follow': true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  };
}

/**
 * Site-wide defaults, set once by the locale layout.
 */
export function siteMetadata(description: string): Metadata {
  return {
    metadataBase: new URL(absoluteUrl('/')),
    title: { default: owner.name, template: `%s${TEMPLATE_SUFFIX}` },
    description,
    applicationName: owner.name,
    authors: [{ name: owner.name }],
    creator: owner.name,
    publisher: owner.name,
    category: 'technology',
    formatDetection: { telephone: false, email: false, address: false },
    robots: robotsFor(),
    verification: {
      google: env.GOOGLE_SITE_VERIFICATION,
      other: env.BING_SITE_VERIFICATION
        ? { 'msvalidate.01': env.BING_SITE_VERIFICATION }
        : undefined,
    },
  };
}

export function pageMetadata({
  locale,
  path,
  title,
  absoluteTitle,
  description,
  type = 'website',
  canonicalPath,
  noindex,
  modifiedTime,
}: PageMetadataInput): Metadata {
  const resolvedTitle = absoluteTitle
    ? fitTitle(absoluteTitle, false)
    : fitTitle(title ?? owner.name, true);
  const fullTitle = absoluteTitle ? resolvedTitle : resolvedTitle + TEMPLATE_SUFFIX;
  const canonical = absoluteUrl(localizedPath(locale, canonicalPath ?? path));
  const alternateLocale = routing.locales
    .filter((other) => other !== locale)
    .map((other) => ogLocales[other]);

  return {
    title: absoluteTitle ? { absolute: resolvedTitle } : resolvedTitle,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(canonicalPath ?? path),
    },
    robots: robotsFor(noindex),
    openGraph: {
      type,
      url: canonical,
      siteName: owner.name,
      title: fullTitle,
      description,
      locale: ogLocales[locale],
      alternateLocale,
      ...(type === 'article' && modifiedTime ? { modifiedTime } : {}),
      ...(type === 'profile' ? { firstName: owner.givenName, lastName: owner.familyName } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}
