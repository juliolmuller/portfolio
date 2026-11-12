'use client';

import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { loadSnapshot } from '@/components/terminal/snapshot-client';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { type AppLocale } from '@/i18n/routing';
import { useReducedMotionPreference } from '@/lib/motion-preference';
import { isTerminalShortcut } from '@/lib/shortcuts';
import { SHEET_BREAKPOINT } from '@/lib/window-manager/geometry';
import { useWindowStore } from '@/stores/window-store';

import { SessionPill } from './session-pill';
import { TERMINAL_ID, terminalTitle, toggleTerminal } from './terminal-controls';
import { useWindowSync } from './use-window-sync';
import { WindowFrame } from './window-frame';

// The terminal, its commands and its strings are one lazy chunk.
const TerminalApp = dynamic(() => import('@/components/terminal/terminal-app'), {
  ssr: false,
});

// Below the sheet breakpoint (Tailwind `sm`, 640 px) the header button (from md) and the menu item are the entries (D80, D82).
const DOCK_QUERY = `(min-width: ${SHEET_BREAKPOINT}px)`;
const HINT_KEY = 'jm.terminal.hint.v1';
const HINT_DELAY_MS = 1500;
const HINT_VISIBLE_MS = 6000;

function isTypingOutsideWindow(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement) || target.closest('[data-window]')) {
    return false;
  }

  return target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * One-time "type help" hint: once per session, never after an interaction.
 */
function useDockHint(enabled: boolean): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    if (!window.matchMedia(DOCK_QUERY).matches) return;

    try {
      if (sessionStorage.getItem(HINT_KEY)) return;
    } catch {
      return;
    }

    let interacted = false;
    let hideTimer: number | undefined;
    const interact = (): void => {
      interacted = true;
      setVisible(false);
    };
    const showTimer = window.setTimeout(() => {
      if (interacted) return;

      try {
        sessionStorage.setItem(HINT_KEY, '1');
      } catch {
        // The hint may repeat without storage; harmless.
      }

      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), HINT_VISIBLE_MS);
    }, HINT_DELAY_MS);

    const events = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
    for (const name of events) window.addEventListener(name, interact, { once: true });

    return (): void => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      for (const name of events) window.removeEventListener(name, interact);
    };
  }, [enabled]);

  return visible;
}

/**
 * The first window of the manager: the terminal.
 */
export function TerminalWindow(): React.JSX.Element {
  const t = useTranslations('window');
  const locale = useLocale() as AppLocale;
  const reduced = useReducedMotionPreference();
  const win = useWindowStore((state) => state.windows[TERMINAL_ID]);

  useWindowSync(TERMINAL_ID, terminalTitle('~'));

  const hint = useDockHint(!reduced && !win);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isTerminalShortcut(event) || isTypingOutsideWindow(event.target)) {
        return;
      }

      event.preventDefault();
      toggleTerminal();
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target as Element).closest('[data-window]')) {
        useWindowStore.getState().blur();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);

    return (): void => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  // Warm the snapshot while the browser is idle so the first command is instant.
  useEffect(() => {
    const warm = (): void => {
      loadSnapshot(locale).catch(() => {});
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });

      return (): void => window.cancelIdleCallback(id);
    }

    const id = globalThis.setTimeout(warm, 2000);

    return (): void => globalThis.clearTimeout(id);
  }, [locale]);

  return (
    <>
      {win ? (
        <WindowFrame
          id={TERMINAL_ID}
          title={win.title}
          badge={<SessionPill />}
          labels={{
            window: t('label'),
            controls: t('controls'),
            hint: t('controlsHint'),
            close: t('close'),
            minimize: t('minimize'),
            maximize: t('maximize'),
            restore: t('restore'),
            resizeSheet: t('resizeSheet'),
          }}
        >
          <ErrorBoundary fallback={<p className="p-4 text-small text-danger">{t('error')}</p>}>
            <TerminalApp />
          </ErrorBoundary>
        </WindowFrame>
      ) : null}

      <div
        role="status"
        className="pointer-events-none fixed right-6 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-(--z-dock)"
      >
        {hint ? (
          <span className="block rounded-md max-sm:hidden border border-line-strong bg-surface-2 px-3 py-1.5 text-small text-text-1">
            {t('hint')}
          </span>
        ) : null}
      </div>

      {/* Desktop and tablet only (≥ 640 px); on phones the menu item is the entry (D80, D82). */}
      {win?.status === 'open' ? null : (
        <button
          type="button"
          aria-keyshortcuts="Control+/ Meta+/"
          onClick={toggleTerminal}
          className="fixed right-6 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-(--z-dock) inline-flex min-h-11 max-sm:hidden items-center gap-2 rounded-full border border-line-strong bg-surface-1 px-4 font-mono text-small text-text-1"
        >
          <span aria-hidden="true">&gt;_</span>
          {t('dock')}
          {win?.status === 'minimized' ? (
            <>
              <span
                aria-hidden="true"
                data-dock-activity
                className="size-2 rounded-full bg-term-green"
              />
              <span className="sr-only">{t('dockMinimized')}</span>
            </>
          ) : null}
        </button>
      )}
    </>
  );
}
