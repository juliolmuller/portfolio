import 'server-only';

import { toLogoImage } from '@/lib/admin/upload/image';
import { type SvgData } from '@/lib/content/schema';

import { type LogoCandidate, type LogoKind, type LogoProvider } from './provider';
import { type RemoteIconFetcher } from './remote-icon';
import { closeness } from './terms';

export interface LogoImagePreview {
  /**
   * Re-encoded WebP (`data:` URL); the editor uploads it as an image asset.
   */
  dataUrl: string;
  height: number;
  width: number;
}

export type LogoSuggestion = {
  host: string;
  id: string;
  label: string;
  source: string;
  theme?: 'dark' | 'light';
  url: string;
  variant: LogoKind;
} & ({ image: LogoImagePreview } | { svg: SvgData });

export interface LogoSearchResult {
  results: LogoSuggestion[];
  /**
   * `unavailable`: every provider failed (or none is enabled).
   */
  status: 'no-match' | 'ok' | 'unavailable';
}

const MAX_CANDIDATES = 12;
const MAX_RESULTS = 8;
const CONCURRENCY = 4;
const KIND_RANK: Record<LogoKind, number> = { icon: 0, unknown: 1, wordmark: 2 };

/**
 * Lower is better: a full-viewBox background shape flattens to a solid block,
 * wordmarks are less useful than marks, fewer paths are lighter.
 */
export function score(svg: SvgData, variant: LogoKind): number {
  const [x = 0, y = 0, w = 0, h = 0] = svg.viewBox.split(' ').map(Number);
  const first = svg.paths[0] ?? '';
  const full = new RegExp(`^M\\s*${x}[ ,]${y}\\s*[hHvVlL]`).test(first) && w > 0 && h > 0;

  return KIND_RANK[variant] * 10 + (full ? 100 : 0) + svg.paths.length;
}

/**
 * Name closeness first, then marks before wordmarks; stable for ties.
 */
export function rankCandidates(candidates: LogoCandidate[], query: string): LogoCandidate[] {
  return candidates.toSorted(
    (a, b) =>
      closeness(a.name, query) - closeness(b.name, query) || KIND_RANK[a.kind] - KIND_RANK[b.kind],
  );
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;

        next += 1;
        out[index] = await run(items[index] as T, index);
      }
    }),
  );

  return out;
}

type Fetched = { candidate: LogoCandidate; closeness: number; order: number } & (
  { image: LogoImagePreview } | { svg: SvgData }
);

/**
 * Shortcut: no server-side result cache; the client caches per session and the
 * route is rate limited. Add one if provider quotas get tight.
 */
export function createLogoSearch(deps: { fetcher: RemoteIconFetcher; provider: LogoProvider }) {
  return async function search(query: string, signal?: AbortSignal): Promise<LogoSearchResult> {
    const name = query.trim().slice(0, 64);

    if (name.length < 2) return { status: 'no-match', results: [] };

    let found: LogoCandidate[];

    try {
      found = await deps.provider.search(name, signal);
    } catch {
      return { status: 'unavailable', results: [] };
    }

    const candidates = rankCandidates(found, name).slice(0, MAX_CANDIDATES);

    const fetched = await mapLimit(
      candidates,
      CONCURRENCY,
      async (candidate, order): Promise<Fetched | null> => {
        try {
          const result = await deps.fetcher.fetch(candidate.url, signal);

          if (!result.ok) return null;

          const base = { candidate, order, closeness: closeness(candidate.name, name) };

          if ('svg' in result) return { ...base, svg: result.svg };

          const image = await toLogoImage(result.image);

          return 'dataUrl' in image ? { ...base, image } : null;
        } catch {
          return null; // one bad candidate must not discard the others
        }
      },
    );

    const results = fetched
      .filter((item) => item !== null)
      .toSorted(
        (a, b) =>
          a.closeness - b.closeness
          || ('svg' in a ? score(a.svg, a.candidate.kind) : KIND_RANK[a.candidate.kind] * 10)
            - ('svg' in b ? score(b.svg, b.candidate.kind) : KIND_RANK[b.candidate.kind] * 10)
          || a.order - b.order,
      )
      .slice(0, MAX_RESULTS)
      .map((item): LogoSuggestion => {
        const { candidate } = item;
        const base = {
          id: candidate.sourceId + (candidate.theme ? `:${candidate.theme}` : ''),
          label: candidate.name,
          source: candidate.source,
          host: safeHost(candidate.url) ?? '',
          url: candidate.source === 'logo-dev' ? '' : candidate.url, // its URL carries the key
          variant: candidate.kind,
          ...(candidate.theme ? { theme: candidate.theme } : {}),
        };

        return 'svg' in item ? { ...base, svg: item.svg } : { ...base, image: item.image };
      });

    return { status: results.length > 0 ? 'ok' : 'no-match', results };
  };
}

function safeHost(url: string): null | string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
