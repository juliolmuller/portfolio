import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';

import { About } from '@/components/sections/about';
import { Contact } from '@/components/sections/contact';
import { Hero } from '@/components/sections/hero';
import { Recommended } from '@/components/sections/recommended';
import { Resume } from '@/components/sections/resume';
import { Stack } from '@/components/sections/stack';
import { Work } from '@/components/sections/work';
import { JsonLd } from '@/components/seo/json-ld';
import { owner } from '@/config/site';
import { type AppLocale, isAppLocale, routing } from '@/i18n/routing';
import { featuredProjects, getContent } from '@/lib/content';
import {
  graph,
  personNode,
  profilePageNode,
  projectListNode,
  websiteNode,
} from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';
import { pickDescription } from '@/lib/seo/text';
import { absoluteUrl, localizedPath } from '@/lib/seo/urls';

async function currentLocale(): Promise<AppLocale> {
  const locale = await rootLocale();

  return isAppLocale(locale) ? locale : routing.defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const [t, profile] = await Promise.all([
    getTranslations('meta'),
    getContent().getProfile(locale),
  ]);

  return pageMetadata({
    locale,
    path: '/',
    absoluteTitle: t('homeTitle', {
      name: owner.name,
      jobTitle: owner.jobTitle,
    }),
    description: pickDescription(
      profile?.heroLead,
      t('siteDescription', {
        name: owner.name,
        jobTitle: owner.jobTitle,
        city: `${owner.city}, ${owner.country}`,
      }),
    ),
    type: 'profile',
    modifiedTime: profile?.updatedAt,
  });
}

/**
 * Newest `updatedAt` among the documents the home page renders.
 */
function newest(...dates: Array<string | undefined>): string {
  return dates
    .filter((date): date is string => Boolean(date))
    .reduce((latest, date) => (date > latest ? date : latest), '');
}

export default async function HomePage(): Promise<React.JSX.Element> {
  const locale = await currentLocale();
  const content = getContent();
  const [
    profile,
    contact,
    resume,
    links,
    recommended,
    projects,
    experience,
    education,
    technologies,
    practices,
  ] = await Promise.all([
    content.getProfile(locale),
    content.getContact(locale),
    content.getResume(),
    content.getFeaturedLinks(locale),
    content.getRecommendedProfiles(locale),
    content.getProjects(locale),
    content.getExperience(locale),
    content.getEducation(locale),
    content.getTechnologies(locale),
    content.getPractices(locale),
  ]);
  const featured = featuredProjects(projects);
  const listId = `${absoluteUrl(localizedPath(locale))}#work`;
  const nextSection = profile ? 'about' : 'stack';

  const jsonLd = graph(
    websiteNode(locale),
    ...(profile
      ? [
          personNode({ locale, profile, links, technologies, practices }),
          profilePageNode(
            locale,
            newest(
              profile.updatedAt,
              resume?.updatedAt,
              ...projects.map((project) => project.updatedAt),
            ),
          ),
        ]
      : []),
    ...(featured.length > 0 ? [projectListNode(locale, featured, listId)] : []),
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <Hero profile={profile} nextSection={nextSection} />
      {profile ? <About locale={locale} profile={profile} /> : null}
      {technologies.length > 0 ? <Stack technologies={technologies} practices={practices} /> : null}
      {featured.length > 0 ? <Work projects={featured} technologies={technologies} /> : null}
      {experience.length > 0 || education.length > 0 ? (
        <Resume
          locale={locale}
          experience={experience}
          education={education}
          technologies={technologies}
          resume={resume}
          links={links}
        />
      ) : null}
      <Contact locale={locale} contact={contact} links={links} resume={resume} />
      <Recommended profiles={recommended} />
    </>
  );
}
