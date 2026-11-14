'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Paragraphs } from '@/components/ui/paragraphs';
import { isClamped } from '@/lib/clamp';
import { cn } from '@/lib/cn';

export interface ToggleLabels {
  less: string;
  more: string;
}

const toggleClass =
  'relative text-small text-accent-2 underline underline-offset-4 after:absolute after:-inset-x-2 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[""]';

/**
 * A role summary clamped to four lines by CSS from the first paint; the full
 * text is in the HTML once (D90). "More" is rendered only after a measurement
 * says the text is cut, so nothing shifts and no-JS visitors see all the text
 * (the clamp is lifted with `(scripting: none)`, since the CSP forbids inline
 * `<noscript><style>`).
 */
export function RoleSummary({
  text,
  title,
  labels,
}: {
  labels: ToggleLabels;
  text: string;
  title: string;
}): React.JSX.Element {
  const id = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const lessRef = useRef<HTMLButtonElement>(null);
  const handoffRef = useRef(false);
  const [clamped, setClamped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const box = boxRef.current;

    if (!box || expanded) return;

    let active = true;
    // A stale callback (e.g. fonts resolving after the user expanded) must not measure.
    const measure = (): void => {
      if (active) setClamped(isClamped(box.scrollHeight, box.clientHeight));
    };

    // The observer fires once on observe, which does the first measurement.
    const observer = new ResizeObserver(measure);

    observer.observe(box);
    document.fonts.ready.then(measure).catch(() => undefined);

    return (): void => {
      active = false;
      observer.disconnect();
    };
  }, [text, expanded]);

  useEffect(() => {
    if (!handoffRef.current) return;

    handoffRef.current = false;

    if (expanded) {
      lessRef.current?.focus({ preventScroll: true });
      // Keep the focused control visible when the expanded text runs below the viewport.
      lessRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    } else {
      moreRef.current?.focus({ preventScroll: true });
      moreRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [expanded]);

  const toggle = (event: React.MouseEvent<HTMLButtonElement>): void => {
    handoffRef.current = document.activeElement === event.currentTarget;
    setExpanded((value) => !value);
  };

  // Tells several roles' toggles apart for screen readers (WCAG 2.4.6).
  const suffix = <span className="sr-only">: {title}</span>;

  return (
    <div className="relative mt-3 text-text-2">
      <div
        id={id}
        data-summary
        ref={boxRef}
        className={cn(!expanded && 'line-clamp-4 noscript:line-clamp-none')}
      >
        <Paragraphs
          text={text}
          after={
            expanded ? (
              <button
                ref={lessRef}
                type="button"
                aria-expanded
                aria-controls={id}
                className={toggleClass}
                onClick={toggle}
              >
                {labels.less}
                {suffix}
              </button>
            ) : null
          }
        />
      </div>
      {clamped && !expanded ? (
        <button
          ref={moreRef}
          type="button"
          aria-expanded={false}
          aria-controls={id}
          className={cn(
            toggleClass,
            'absolute right-0 bottom-0 bg-bg-0 pl-1 forced-colors:bg-[Canvas]',
            'before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-8 before:bg-linear-to-r before:from-transparent before:to-bg-0 forced-colors:before:hidden',
          )}
          onClick={toggle}
        >
          {labels.more}
          {suffix}
        </button>
      ) : null}
    </div>
  );
}
