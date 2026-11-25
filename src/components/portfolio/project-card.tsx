import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

import { Tilt } from '@/components/motion/tilt';
import { buttonVariants } from '@/components/ui/button';
import { cardSurface } from '@/components/ui/card-styles';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { type ProjectStatus, type ProjectSummary } from '@/lib/content';

import { CoverTransition } from './cover-transition';
import { GeneratedCover } from './generated-cover';

const MAX_CHIPS = 4;

const STATUS_DOT: Record<ProjectStatus, string> = {
  'live': 'bg-term-green shadow-[0_0_8px_rgb(74_222_128/0.7)]',
  'in-progress': 'bg-warn',
  'archived': 'bg-text-3',
  'private': 'bg-accent-1',
};

interface ProjectCardProps {
  /**
   * Above-the-fold covers load eagerly.
   */
  eager?: boolean;
  headingLevel?: 'h2' | 'h3';
  /**
   * The likely LCP element: fetched at high priority.
   */
  lcp?: boolean;
  project: ProjectSummary;
  /**
   * Names of the project's skills, in order.
   */
  skillNames: readonly string[];
}

/**
 * Cover, kind and status, title, summary, up to four skill chips and the CTAs.
 * The whole card is clickable through the stretched "View details" link; "Visit
 * app" sits above it as its own tab stop.
 */
export async function ProjectCard({
  project,
  skillNames,
  headingLevel: Heading = 'h3',
  eager = false,
  lcp = false,
}: ProjectCardProps): Promise<React.JSX.Element> {
  const t = await getTranslations('work');
  const chips = skillNames.slice(0, MAX_CHIPS);
  const overflow = skillNames.length - chips.length;
  const live = project.links.live;

  return (
    <article className="h-full">
      <Tilt className="h-full">
        <div
          className={cn(
            cardSurface,
            'flex h-full flex-col overflow-hidden',
            'has-[[data-stretched]:focus-visible]:outline-2 has-[[data-stretched]:focus-visible]:outline-offset-2 has-[[data-stretched]:focus-visible]:outline-accent-2',
          )}
        >
          <div className="relative aspect-[16/10] overflow-hidden border-b border-line">
            <CoverTransition slug={project.slug}>
              {project.cover ? (
                <Image
                  src={project.cover.url}
                  width={project.cover.width}
                  height={project.cover.height}
                  alt={project.cover.alt}
                  sizes="(min-width: 1100px) 384px, (min-width: 768px) 50vw, 100vw"
                  loading={eager ? 'eager' : 'lazy'}
                  fetchPriority={lcp ? 'high' : undefined}
                  placeholder={project.cover.lqip ? 'blur' : 'empty'}
                  blurDataURL={project.cover.lqip}
                  className="size-full object-cover transition-transform duration-500 ease-out-expo group-hover/card:scale-[1.04]"
                  style={
                    project.cover.focal
                      ? {
                          objectPosition: `${project.cover.focal.x * 100}% ${project.cover.focal.y * 100}%`,
                        }
                      : undefined
                  }
                />
              ) : (
                <GeneratedCover
                  slug={project.slug}
                  kind={project.kind}
                  className="transition-transform duration-500 ease-out-expo group-hover/card:scale-[1.04]"
                />
              )}
            </CoverTransition>
            <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              <span className="rounded-sm border border-line-strong glass px-2 py-1 font-label text-text-1">
                {t(`kinds.${project.kind}`)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong glass px-2.5 py-1 text-[0.75rem] text-text-1">
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 rounded-full', STATUS_DOT[project.status])}
                />
                {t(`statuses.${project.status}`)}
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-5 sm:p-6">
            <Heading className="text-h3">{project.title}</Heading>
            <p className="mt-2 line-clamp-3 text-[0.9375rem] text-text-2">{project.summary}</p>
            {chips.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {chips.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.75rem] text-text-2"
                  >
                    {name}
                  </li>
                ))}
                {overflow > 0 ? (
                  <li className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.75rem] text-text-2">
                    <span aria-hidden="true">+{overflow}</span>
                    <span className="sr-only">{t('moreSkills', { count: overflow })}</span>
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
              {live ? (
                <a
                  href={live}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('visitAppLabel', { title: project.title })}
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'sm' }),
                    'relative z-10',
                  )}
                >
                  {t('visitApp')}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              ) : null}
              <Link
                href={`/projects/${project.slug}`}
                data-stretched=""
                aria-label={t('viewDetailsLabel', { title: project.title })}
                className={cn(
                  buttonVariants({
                    variant: live ? 'secondary' : 'primary',
                    size: 'sm',
                  }),
                  // `static` so the ::after covers the card, not the button.
                  'static after:absolute after:inset-0 after:rounded-lg after:content-[""] focus-visible:outline-none',
                )}
              >
                {t('viewDetails')}
                <ArrowRight
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover/card:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </div>
      </Tilt>
    </article>
  );
}
