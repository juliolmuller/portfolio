import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { notFound, permanentRedirect } from 'next/navigation';

import { TechIcon } from '@/components/content/tech-icon';
import { Markdown } from '@/components/markdown/markdown';
import { CoverTransition } from '@/components/portfolio/cover-transition';
import { DeviceFrame } from '@/components/portfolio/device-frame';
import { Gallery } from '@/components/portfolio/gallery';
import { GeneratedCover } from '@/components/portfolio/generated-cover';
import { ProjectCard } from '@/components/portfolio/project-card';
import { techNameLookup } from '@/components/portfolio/tech-names';
import { Breadcrumb } from '@/components/seo/breadcrumb';
import { JsonLd } from '@/components/seo/json-ld';
import { ButtonAnchor, ButtonLink } from '@/components/ui/button';
import { currentLocale } from '@/i18n/locale';
import { getContent } from '@/lib/content';
import { type Project } from '@/lib/content/types';
import { projectNeighbors, relatedProjects } from '@/lib/projects';
import { breadcrumbNode, graph, personNode, projectNode, websiteNode } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';
import { pickDescription } from '@/lib/seo/text';
import { absoluteUrl, localizedPath } from '@/lib/seo/urls';

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const routes = await getContent().getProjectRoutes();

  return routes.map((route) => ({ slug: route.slug }));
}

async function loadProject(
  slug: string,
): Promise<{ locale: Awaited<ReturnType<typeof currentLocale>>; project: Project }> {
  const locale = await currentLocale();
  const lookup = await getContent().getProject(locale, slug);

  if (lookup.status === 'missing') notFound();

  if (lookup.status === 'moved') {
    permanentRedirect(`/${locale}/projects/${lookup.slug}`);
  }

  return { locale, project: lookup.project };
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const { locale, project } = await loadProject(slug);

  return pageMetadata({
    locale,
    path: `/projects/${project.slug}`,
    title: project.title,
    description: pickDescription(project.summary, project.tagline, project.context),
    modifiedTime: project.updatedAt,
  });
}

export default async function ProjectPage({
  params,
}: PageProps<'/[locale]/projects/[slug]'>): Promise<React.JSX.Element> {
  const { slug } = await params;
  const { locale, project } = await loadProject(slug);
  const content = getContent();
  const [t, tWork, tA11y, tProjects, all, technologies, profile, links, practices] =
    await Promise.all([
      getTranslations('project'),
      getTranslations('work'),
      getTranslations('a11y'),
      getTranslations('projects'),
      content.getProjects(locale),
      content.getTechnologies(locale),
      content.getProfile(locale),
      content.getFeaturedLinks(locale),
      content.getPractices(locale),
    ]);

  const namesFor = techNameLookup(technologies);
  const techById = new Map(technologies.map((tech) => [tech.id, tech]));
  const usedTech = project.techIds
    .map((id) => techById.get(id))
    .filter((tech) => tech !== undefined);
  const related = relatedProjects(project, all);
  const neighbors = projectNeighbors(project, all);
  const crumbs = [
    { name: tProjects('home'), path: '/' },
    { name: tWork('eyebrow'), path: '/projects' },
    { name: project.title, path: `/projects/${project.slug}` },
  ];
  const url = absoluteUrl(localizedPath(locale, `/projects/${project.slug}`));

  const jsonLd = graph(
    websiteNode(locale),
    ...(profile ? [personNode({ locale, profile, links, technologies, practices })] : []),
    projectNode(locale, project, technologies),
    breadcrumbNode(locale, crumbs, `${url}#crumbs`),
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <article className="section-y">
        <div className="container-page">
          <Breadcrumb crumbs={crumbs} />
          <header className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end">
            <div>
              <h1 className="text-h2">{project.title}</h1>
              <p className="mt-4 measure text-text-2">{project.tagline}</p>
              <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-small text-text-3">
                <Meta label={t('year')} value={String(project.year)} />
                <Meta label={t('kind')} value={tWork(`kinds.${project.kind}`)} />
                <Meta label={t('status')} value={tWork(`statuses.${project.status}`)} />
                <Meta label={t('role')} value={project.role} />
              </dl>
              <div className="mt-8 flex flex-wrap gap-3">
                {project.links.live ? (
                  <ButtonAnchor
                    href={project.links.live}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tWork('visitAppLabel', {
                      title: project.title,
                    })}
                  >
                    {tWork('visitApp')}
                    <ArrowUpRight aria-hidden="true" />
                  </ButtonAnchor>
                ) : null}
                {project.links.repo ? (
                  <ButtonAnchor
                    href={project.links.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    aria-label={t('repositoryLabel', { title: project.title })}
                  >
                    {t('repository')}
                    <ArrowUpRight aria-hidden="true" />
                  </ButtonAnchor>
                ) : null}
                <ButtonLink href="/projects" variant="ghost">
                  <ArrowLeft aria-hidden="true" />
                  {tWork('allProjects')}
                </ButtonLink>
              </div>
            </div>
            <DeviceFrame kind={project.kind}>
              <CoverTransition slug={project.slug}>
                {project.cover ? (
                  <Image
                    src={project.cover.url}
                    width={project.cover.width}
                    height={project.cover.height}
                    alt={project.cover.alt}
                    sizes="(min-width: 1024px) 448px, 100vw"
                    preload
                    fetchPriority="high"
                    placeholder={project.cover.lqip ? 'blur' : 'empty'}
                    blurDataURL={project.cover.lqip}
                    className="size-full object-cover"
                    style={
                      project.cover.focal
                        ? {
                            objectPosition: `${project.cover.focal.x * 100}% ${project.cover.focal.y * 100}%`,
                          }
                        : undefined
                    }
                  />
                ) : (
                  <GeneratedCover slug={project.slug} kind={project.kind} />
                )}
              </CoverTransition>
            </DeviceFrame>
          </header>

          <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
            <div className="space-y-12">
              <Block title={t('context')} body={project.context} />
              <Block title={t('approach')} body={project.approach} />
              <section>
                <h2 className="text-h3">{t('highlights')}</h2>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-text-2">
                  {project.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              {project.outcome ? <Block title={t('outcome')} body={project.outcome} /> : null}
              {project.body ? (
                <section>
                  <h2 className="text-h3">{t('details')}</h2>
                  <Markdown
                    className="mt-5"
                    topHeadingLevel={3}
                    idPrefix="story"
                    images={project.gallery}
                    newTabLabel={tA11y('opensInNewTab')}
                    scrollRegionLabel={tA11y('scrollRegion')}
                  >
                    {project.body}
                  </Markdown>
                </section>
              ) : null}
              {usedTech.length > 0 ? (
                <section>
                  <h2 className="text-h3">{t('technologies')}</h2>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {usedTech.map((tech) => (
                      <li
                        key={tech.id}
                        className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-small text-text-1"
                      >
                        <TechIcon icon={tech.icon} className="text-text-2" />
                        {tech.name}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {project.gallery.length > 0 ? (
                <section>
                  <h2 className="text-h3">{t('gallery')}</h2>
                  <div className="mt-5">
                    <Gallery images={project.gallery} />
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="lg:sticky lg:top-24">
              <h2 className="font-label text-text-3">{t('facts')}</h2>
              <dl className="mt-4 space-y-3 text-small">
                <Meta label={t('year')} value={String(project.year)} stacked />
                <Meta label={t('kind')} value={tWork(`kinds.${project.kind}`)} stacked />
                <Meta label={t('status')} value={tWork(`statuses.${project.status}`)} stacked />
                <Meta label={t('role')} value={project.role} stacked />
              </dl>
            </aside>
          </div>

          {related.length > 0 ? (
            <section className="mt-20">
              <h2 className="text-h3">{t('related')}</h2>
              <ul className="mt-8 grid gap-6 min-[1100px]:grid-cols-3 md:grid-cols-2">
                {related.map((item) => (
                  <li key={item.id}>
                    <ProjectCard project={item} techNames={namesFor(item.techIds)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {neighbors ? (
            <nav
              aria-label={t('projectNav')}
              className="mt-16 flex flex-wrap justify-between gap-4 border-t border-line pt-8"
            >
              <ButtonLink href={`/projects/${neighbors.previous.slug}`} variant="ghost">
                <ArrowLeft aria-hidden="true" />
                <span>
                  <span className="block font-label text-text-3">{t('previousProject')}</span>
                  {neighbors.previous.title}
                </span>
              </ButtonLink>
              <ButtonLink
                href={`/projects/${neighbors.next.slug}`}
                variant="ghost"
                className="ml-auto"
              >
                <span className="text-right">
                  <span className="block font-label text-text-3">{t('nextProject')}</span>
                  {neighbors.next.title}
                </span>
                <ArrowRight aria-hidden="true" />
              </ButtonLink>
            </nav>
          ) : null}
        </div>
      </article>
    </>
  );
}

function Meta({
  label,
  value,
  stacked,
}: {
  label: string;
  stacked?: boolean;
  value: string;
}): React.JSX.Element {
  return (
    <div className={stacked ? 'flex flex-col gap-1' : 'flex gap-2'}>
      <dt className="text-text-3">{label}</dt>
      <dd className="text-text-1">{value}</dd>
    </div>
  );
}

function Block({ title, body }: { body: string; title: string }): React.JSX.Element {
  return (
    <section>
      <h2 className="text-h3">{title}</h2>
      <p className="mt-4 measure text-text-2">{body}</p>
    </section>
  );
}
