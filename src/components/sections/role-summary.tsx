'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Paragraphs } from '@/components/ui/paragraphs';
import { isClamped } from '@/lib/clamp';
import { cn } from '@/lib/cn';

export interface ToggleLabels {
  less: string;
  more: string;
}

/**
 * A role summary clamped to four lines by CSS from the first paint; the full
 * text is in the HTML once (D90). The "Show more" button sits beneath the text
 * and is rendered only after a measurement says the text is cut; no-JS visitors
 * see all the text (the clamp is lifted with `(scripting: none)`, since the CSP
 * forbids inline `<noscript><style>`).
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
  const buttonRef = useRef<HTMLButtonElement>(null);
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

    const box = boxRef.current;
    // `clamped` is stale after an expanded resize: if the text now fits, the button vanishes.
    const target =
      !expanded && box && !isClamped(box.scrollHeight, box.clientHeight) ? box : buttonRef.current;

    target?.focus({ preventScroll: true });
    // Keep the focused control visible when the text above it grew or shrank.
    target?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [expanded]);

  const toggle = (event: React.MouseEvent<HTMLButtonElement>): void => {
    handoffRef.current = document.activeElement === event.currentTarget;
    setExpanded((value) => !value);
  };

  return (
    <div className="mt-3 text-text-2">
      <div
        id={id}
        data-summary
        tabIndex={-1}
        ref={boxRef}
        className={cn(!expanded && 'line-clamp-4 noscript:line-clamp-none')}
      >
        <Paragraphs text={text} />
      </div>
      {clamped || expanded ? (
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center text-small text-accent-2 underline underline-offset-4"
          onClick={toggle}
        >
          {expanded ? labels.less : labels.more}
          {/* Tells several roles' toggles apart for screen readers (WCAG 2.4.6). */}
          <span className="sr-only">: {title}</span>
        </button>
      ) : null}
    </div>
  );
}
