import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { KindFilter } from '@/components/portfolio/kind-filter';
import { Pagination } from '@/components/portfolio/pagination';
import { ProjectCard } from '@/components/portfolio/project-card';
import { techNameLookup } from '@/components/portfolio/tech-names';
import { Breadcrumb } from '@/components/seo/breadcrumb';
import { JsonLd } from '@/components/seo/json-ld';
import { owner } from '@/config/site';
import { currentLocale } from '@/i18n/locale';
import { getContent, indexOrder } from '@/lib/content';
import {
  filterByKind,
  kindsWithCounts,
  paginate,
  parseProjectsQuery,
  PROJECTS_PAGE_SIZE,
  projectsHref,
} from '@/lib/projects';
import {
  breadcrumbNode,
  collectionPageNode,
  graph,
  personNode,
  projectListNode,
  websiteNode,
} from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';
import { pickDescription } from '@/lib/seo/text';
import { absoluteUrl, localizedPath } from '@/lib/seo/urls';

export const revalidate = 86400;

export async function generateMetadata({
  searchParams,
}: PageProps<'/[locale]/projects'>): Promise<Metadata> {
  const locale = await currentLocale();
  const search = await searchParams;
  const parsed = parseProjectsQuery(search);

  if (!parsed.ok) return {};

  const { kind, page } = parsed.query;
  const t = await getTranslations('projects');
  const kindLabel = kind ? t(`filters.${kind}`) : undefined;
  const title =
    kind && kindLabel
      ? t('filteredTitle', { kind: kindLabel })
      : page > 1
        ? t('pageTitle', { page })
        : t('title');

  return pageMetadata({
    locale,
    path: projectsHref({ kind, page }),
    title,
    description: pickDescription(t('metaDescription', { name: owner.name }), t('intro')),
    canonicalPath: kind ? '/projects' : projectsHref({ page }),
    noindex: Boolean(kind),
  });
}

export default async function ProjectsPage({
  searchParams,
}: PageProps<'/[locale]/projects'>): Promise<React.JSX.Element> {
  const locale = await currentLocale();
  const parsed = parseProjectsQuery(await searchParams);

  if (!parsed.ok) notFound();

  const content = getContent();
  const [t, projects, technologies, profile, links, practices] = await Promise.all([
    getTranslations('projects'),
    content.getProjects(locale).then(indexOrder),
    content.getTechnologies(locale),
    content.getProfile(locale),
    content.getFeaturedLinks(locale),
    content.getPractices(locale),
  ]);

  const { kind, page } = parsed.query;
  const available = kindsWithCounts(projects);

  if (kind && !available.some((entry) => entry.kind === kind)) notFound();

  const filtered = filterByKind(projects, kind);
  const listing = paginate(filtered, page);

  if (listing.outOfRange) notFound();

  const namesFor = techNameLookup(technologies);
  const crumbs = [
    { name: t('home'), path: '/' },
    { name: t('title'), path: '/projects' },
  ];
  const path = projectsHref({ kind, page });
  const url = absoluteUrl(localizedPath(locale, path));
  const listId = `${url}#list`;
  const breadcrumbId = `${url}#crumbs`;

  const jsonLd = graph(
    websiteNode(locale),
    ...(profile ? [personNode({ locale, profile, links, technologies, practices })] : []),
    collectionPageNode(locale, path, t('title'), t('intro'), {
      breadcrumbId,
      listId,
    }),
    breadcrumbNode(locale, crumbs, breadcrumbId),
    projectListNode(locale, listing.items, listId, (page - 1) * PROJECTS_PAGE_SIZE),
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="section-y">
        <div className="container-page">
          <Breadcrumb crumbs={crumbs} />
          <header className="mt-8 max-w-3xl">
            <h1 className="text-h2">{t('title')}</h1>
            <p className="mt-5 measure text-text-2">{t('intro')}</p>
          </header>

          {available.length > 1 ? (
            <div className="mt-10">
              <KindFilter kinds={available} active={kind} />
            </div>
          ) : null}

          <p className="sr-only" aria-live="polite">
            {t('showing', { count: listing.total })}
          </p>

          <ul className="mt-10 grid gap-6 min-[1100px]:grid-cols-3 md:grid-cols-2">
            {listing.items.map((project, index) => (
              <li key={project.id}>
                <ProjectCard
                  project={project}
                  techNames={namesFor(project.techIds)}
                  headingLevel="h2"
                  eager={index < 3}
                  lcp={index === 0}
                />
              </li>
            ))}
          </ul>

          <Pagination page={page} totalPages={listing.totalPages} kind={kind} />
        </div>
      </div>
    </>
  );
}
