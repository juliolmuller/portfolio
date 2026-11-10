'use client';

import { type ReactNode, useEffect, useRef } from 'react';

import { usePathname } from '@/i18n/navigation';

const SCROLL_THRESHOLD = 24;

/**
 * Fixed header that turns into frosted glass after 24px of scroll. The state
 * lives in a data attribute so scrolling never re-renders React.
 */
export function HeaderFrame({ children }: { children: ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const header = ref.current;

    if (!header) return;

    let frame = 0;
    const update = (): void => {
      frame = 0;
      const scrolled = window.scrollY > SCROLL_THRESHOLD;

      if ((header.dataset.scrolled === 'true') !== scrolled) {
        header.dataset.scrolled = String(scrolled);
      }
    };
    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });

    return (): void => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // The hero title already shows the name: hide the wordmark name while it is
  // on screen (CSS reads `data-hero`). The header outlives route changes.
  useEffect(() => {
    const header = ref.current;

    if (!header) return;

    const hero = document.getElementById('top');

    if (!hero) {
      header.dataset.hero = 'false';

      return;
    }

    const offset = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
    );
    const observer = new IntersectionObserver(
      ([entry]) => {
        header.dataset.hero = String(entry?.isIntersecting ?? false);
      },
      { rootMargin: `-${offset || 0}px 0px 0px 0px`, threshold: 0 },
    );

    // Track the name itself: nav jumps leave the hero's bottom padding under the header.
    observer.observe(document.getElementById('hero-title') ?? hero);

    return (): void => observer.disconnect();
  }, [pathname]);

  return (
    <header
      ref={ref}
      data-scrolled="false"
      className="group/header fixed inset-x-0 top-0 z-(--z-header) border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-300 data-[scrolled=true]:border-line data-[scrolled=true]:glass"
    >
      {children}
    </header>
  );
}
