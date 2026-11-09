'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { searchIconsAction } from '@/lib/admin/actions';
import { type IconHit } from '@/lib/admin/icons';
import { type LogoSearchResult, type LogoSuggestion } from '@/lib/admin/logo-search/search';

export interface CatalogHit extends IconHit {
  source: 'devicon' | 'simple-icons';
}

export type SearchStatus = 'idle' | 'no-match' | 'ok' | 'searching' | 'unavailable';

interface Cached {
  catalog: CatalogHit[];
  online: LogoSuggestion[];
  status: SearchStatus;
}

const CATALOG_DELAY = 220;
const ONLINE_DELAY = 450;

/**
 * Searches only when `search` is called from a real edit: never on mount, focus
 * or prefill. Each call cancels the previous timers and request.
 */
export function useLogoSearch(): Cached & { search: (query: string) => void } {
  const [state, setState] = useState<Cached>({ catalog: [], online: [], status: 'idle' });
  const cacheRef = useRef(new Map<string, Cached>());
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);

  const cancel = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;

    for (const timer of timersRef.current) window.clearTimeout(timer);

    timersRef.current = [];
  }, []);

  useEffect(() => cancel, [cancel]);

  const search = useCallback(
    (raw: string): void => {
      const query = raw.trim();

      cancel();

      if (query.length < 2) {
        setState({ catalog: [], online: [], status: 'idle' });

        return;
      }

      const hit = cacheRef.current.get(query.toLowerCase());

      if (hit) {
        setState(hit);

        return;
      }

      const controller = new AbortController();

      abortRef.current = controller;
      setState((current) => ({ ...current, catalog: [], online: [], status: 'searching' }));

      let catalog: CatalogHit[] | null = null;
      let online: null | Pick<Cached, 'online' | 'status'> = null;
      let catalogFailed = false;

      // Cache only once both requests are in, so a fast online answer never stores an empty catalog.
      const settle = (): void => {
        if (catalog && online && !catalogFailed && online.status !== 'unavailable') {
          // Failures are not cached: the next try may succeed.
          cacheRef.current.set(query.toLowerCase(), { catalog, ...online });
        }
      };

      timersRef.current.push(
        window.setTimeout(async () => {
          const [simple, devicon] = await Promise.all([
            searchIconsAction('simple-icons', query).catch(() => {
              catalogFailed = true;

              return [];
            }),
            searchIconsAction('devicon', query).catch(() => {
              catalogFailed = true;

              return [];
            }),
          ]);

          if (controller.signal.aborted) return;

          const hits = [
            ...simple.slice(0, 6).map((item): CatalogHit => ({ ...item, source: 'simple-icons' })),
            ...devicon.slice(0, 6).map((item): CatalogHit => ({ ...item, source: 'devicon' })),
          ];
          catalog = hits;
          setState((current) => ({ ...current, catalog: hits }));
          settle();
        }, CATALOG_DELAY),
        window.setTimeout(async () => {
          let result: LogoSearchResult | null = null;

          try {
            const response = await fetch('/admin/api/logo-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
              signal: controller.signal,
            });

            result = response.ok ? ((await response.json()) as LogoSearchResult) : null;
          } catch {
            if (controller.signal.aborted) return;
          }

          if (controller.signal.aborted) return;

          online = {
            online: result?.results ?? [],
            status: result?.status ?? 'unavailable',
          };
          setState((current) => ({ ...current, ...online }));
          settle();
        }, ONLINE_DELAY),
      );
    },
    [cancel],
  );

  return { ...state, search };
}
