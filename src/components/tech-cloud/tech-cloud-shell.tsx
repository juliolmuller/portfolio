'use client';

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/cn';
import { skillCategories, type SkillCategory } from '@/lib/content/taxonomy';
import { type Practice } from '@/lib/content/types';
import { useReducedMotionPreference } from '@/lib/motion-preference';

import { type CloudTech } from './geoid-sphere';
import { StackList } from './stack-list';
import { geoidStageClassName } from './stage';
import { type StackTech } from './types';

const GeoidSphere = dynamic(() => import('./geoid-sphere').then((module) => module.GeoidSphere), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className={`${geoidStageClassName} rounded-[50%] bg-surface-1/40`} />
  ),
});

function toCloudTech(tech: StackTech): CloudTech {
  return {
    id: tech.id,
    name: tech.name,
    categories: tech.categories,
    icon: tech.icon,
    brandColor: tech.brandColor,
    url: tech.url,
    priority: tech.priority,
  };
}

const NARROW_QUERY = '(max-width: 767px)';

function useMobileCull(technologies: CloudTech[]): CloudTech[] {
  const narrow = useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(NARROW_QUERY);

      media.addEventListener('change', onChange);

      return (): void => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );

  return useMemo(() => {
    if (!narrow) return technologies;

    return technologies.filter((tech) => tech.priority <= 2);
  }, [narrow, technologies]);
}

export function TechCloudShell({
  technologies,
  practices,
}: {
  practices: Practice[];
  technologies: StackTech[];
}): React.JSX.Element {
  const t = useTranslations('stack');
  const reduced = useReducedMotionPreference();
  const isClient = useSyncExternalStore(
    () => (): undefined => undefined,
    () => true,
    () => false,
  );
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<null | SkillCategory>(null);
  const [selected, setSelected] = useState<CloudTech | null>(null);
  const [near, setNear] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const showCloud = isClient && !reduced && !failed;

  const cloudTechs = useMemo(() => technologies.map(toCloudTech), [technologies]);
  const visibleCloud = useMobileCull(cloudTechs);

  const categoryLabels = Object.fromEntries(
    skillCategories.map((key) => [key, t(`categories.${key}`)]),
  ) as Record<SkillCategory, string>;

  const announced =
    selected && (!category || selected.categories.includes(category)) ? selected : null;
  const primaryCategory = announced?.categories[0];

  useEffect(() => {
    if (!selected) return;

    const timer = window.setTimeout(() => setSelected(null), 2500);

    return (): void => window.clearTimeout(timer);
  }, [selected]);

  useEffect(() => {
    if (!showCloud || near) return;

    const host = hostRef.current;

    if (!host) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        setNear(true);
        observer.disconnect();
      },
      { rootMargin: '300px' },
    );

    observer.observe(host);

    return (): void => observer.disconnect();
  }, [showCloud, near]);

  const counts = useMemo(() => {
    const map = new Map<SkillCategory, number>();
    for (const tech of visibleCloud) {
      for (const key of tech.categories) {
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }

    return map;
  }, [visibleCloud]);

  const list = (
    <StackList
      technologies={technologies}
      practices={practices}
      categoryLabels={categoryLabels}
      practicesTitle={t('practicesTitle')}
    />
  );

  const chips = showCloud ? (
    <div
      role="toolbar"
      aria-label={t('filterLabel')}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {skillCategories.map((key) => {
        const count = counts.get(key) ?? 0;

        if (count === 0) return null;

        const active = category === key;
        const label = categoryLabels[key];

        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            aria-label={t('filterChip', { category: label, count })}
            onClick={() => setCategory(active ? null : key)}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-small transition-colors',
              active
                ? 'border-accent-2/50 bg-accent-2/10 text-text-1'
                : 'border-line text-text-2 hover-fine:border-line-strong hover-fine:text-text-1',
            )}
          >
            {label}{' '}
            <span aria-hidden="true" className="text-text-3 tabular-nums">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      {chips ? <div className="container-page">{chips}</div> : null}

      {showCloud ? (
        <>
          <div ref={hostRef}>
            {near ? (
              <ErrorBoundary
                fallback={<div className="container-page">{list}</div>}
                onError={() => setFailed(true)}
              >
                <GeoidSphere
                  technologies={visibleCloud}
                  activeCategory={category}
                  paused={reduced}
                  selectedId={announced?.id ?? null}
                  onSelect={setSelected}
                />
              </ErrorBoundary>
            ) : (
              <div
                aria-hidden="true"
                className={`${geoidStageClassName} rounded-[50%] bg-surface-1/40`}
              />
            )}
          </div>

          <div aria-live="polite" className="container-page text-center text-small text-text-2">
            {announced ? (
              <p>
                <span className="text-text-1">{announced.name}</span>
                {primaryCategory ? (
                  <span className="text-text-3"> · {categoryLabels[primaryCategory]}</span>
                ) : null}
                {announced.url ? (
                  <>
                    {' '}
                    <a
                      href={announced.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-2 underline-offset-4 hover-fine:underline"
                    >
                      {t('officialSite')}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="container-page">{list}</div>
      )}
    </div>
  );
}
