'use client';

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/cn';
import { skillCategories, type SkillCategory } from '@/lib/content/taxonomy';
import { useReducedMotionPreference } from '@/lib/motion-preference';

import { countByCategory, matchesCategory } from './categories';
import { type CloudTech } from './geoid-sphere';
import { StackList } from './stack-list';
import { geoidStageClassName } from './stage';
import { type StackItem } from './types';

const GeoidSphere = dynamic(() => import('./geoid-sphere').then((module) => module.GeoidSphere), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className={`${geoidStageClassName} rounded-[50%] bg-surface-1/40`} />
  ),
});

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
  items,
  cloudItems,
}: {
  cloudItems: CloudTech[];
  items: StackItem[];
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
  const visibleCloud = useMobileCull(cloudItems);
  // An empty cloud (no skill is `inCloud`, or the phone cull removed them all)
  // would hide the List and show a blank stage, so fall back to the List.
  const showCloud = isClient && !reduced && !failed && visibleCloud.length > 0;

  const categoryLabels = Object.fromEntries(
    skillCategories.map((key) => [key, t(`categories.${key}`)]),
  ) as Record<SkillCategory, string>;

  const announced = selected && matchesCategory(selected, category) ? selected : null;
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

  const counts = useMemo(() => countByCategory(visibleCloud), [visibleCloud]);

  const list = <StackList items={items} categoryLabels={categoryLabels} />;

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
