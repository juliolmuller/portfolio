'use client';

import { type ReactNode, useEffect, useRef } from 'react';

import { useReducedMotionPreference } from '@/lib/motion-preference';
import { easeToward, isInside, railProgress, SCROLL_ANCHOR } from '@/lib/timeline-rail';

const FINE_POINTER = '(hover: hover) and (pointer: fine)';

/**
 * Wraps the experience timeline: the rail draws with scroll (scaleY) and, with
 * a fine pointer over the resume section, its tip follows the cursor (eased,
 * D80). Each `[data-timeline-node]` pulses once when the tip passes it. Without
 * JS, or with reduced motion, the rail is simply drawn.
 */
export function TimelineProgress({ children }: { children: ReactNode }): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPreference();

  useEffect(() => {
    const root = rootRef.current;
    const rail = railRef.current;

    if (!root || !rail) return;

    if (reduced) {
      rail.style.transform = '';

      return;
    }

    const section = root.closest('section') ?? root;
    const mq = window.matchMedia(FINE_POINTER);
    let fine = mq.matches;
    let pointer: { x: number; y: number } | null = null;
    let anchorY = window.innerHeight * SCROLL_ANCHOR;
    let frame = 0;
    let lastTime = 0;
    let pending = Array.from(root.querySelectorAll<HTMLElement>('[data-timeline-node]')).filter(
      (node) => node.dataset['reached'] !== 'true',
    );

    const target = (): number => {
      if (fine && pointer && isInside(section.getBoundingClientRect(), pointer.x, pointer.y)) {
        return pointer.y;
      }

      return window.innerHeight * SCROLL_ANCHOR;
    };
    const render = (): void => {
      const rect = root.getBoundingClientRect();

      // Hidden panel (education tab): nothing to draw or mark.
      if (rect.height <= 0) return;

      const progress = railProgress({ anchorY, top: rect.top, height: rect.height });

      rail.style.transform = `scaleY(${progress})`;
      pending = pending.filter((node) => {
        const box = node.getBoundingClientRect();

        if (box.top + box.height / 2 >= anchorY) return true;

        node.dataset['reached'] = 'true';

        return false;
      });
    };
    const tick = (now: number): void => {
      const goal = target();

      anchorY = easeToward(anchorY, goal, now - lastTime);
      lastTime = now;
      render();
      frame = anchorY === goal ? 0 : requestAnimationFrame(tick);
    };
    const schedule = (): void => {
      if (frame) return;

      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    };
    let scrollFrame = 0;
    const onScroll = (): void => {
      if (scrollFrame) return;

      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;

        // Scroll stays instantaneous; the eased loop only runs for cursor moves.
        if (!frame) anchorY = target();

        render();
      });
    };
    const clearPointer = (): void => {
      pointer = null;
      schedule();
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') {
        clearPointer();

        return;
      }

      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') clearPointer();
    };
    const onPointerOut = (event: PointerEvent): void => {
      if (event.relatedTarget === null) clearPointer();
    };
    const onMediaChange = (): void => {
      fine = mq.matches;

      if (!fine) pointer = null;

      schedule();
    };

    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
    window.addEventListener('blur', clearPointer);
    mq.addEventListener('change', onMediaChange);

    return (): void => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('blur', clearPointer);
      mq.removeEventListener('change', onMediaChange);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
    };
  }, [reduced]);

  return (
    <div ref={rootRef} className="relative">
      <div
        aria-hidden="true"
        className="decorative absolute top-2 bottom-2 left-[7px] w-px bg-line"
      >
        <div
          ref={railRef}
          data-timeline-rail
          className="h-full w-full origin-top bg-[linear-gradient(to_bottom,#8b7cff,#4cc9f0)]"
        />
      </div>
      {children}
    </div>
  );
}
