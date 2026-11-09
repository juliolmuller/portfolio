import 'server-only';

import { env } from '@/env';

import { fetchJson, type LogoCandidate, type LogoProvider } from './provider';
import { createIconifyProvider } from './providers/iconify';
import { createLogoDevProvider } from './providers/logo-dev';
import { createSvglProvider } from './providers/svgl';
import { createWorldvectorlogoProvider } from './providers/worldvectorlogo';

/**
 * Asks every provider at once and merges what resolves. A failing provider is
 * logged (id only) and ignored; the aggregate throws only when all of them
 * failed, or when there are none.
 */
export function createAggregateLogoProvider(providers: readonly LogoProvider[]): LogoProvider {
  return {
    id: 'aggregate',
    hosts: [...new Set(providers.flatMap((provider) => provider.hosts))],
    async search(query, signal): Promise<LogoCandidate[]> {
      const settled = await Promise.allSettled(
        providers.map((provider) => provider.search(query, signal)),
      );
      const seen = new Set<string>();
      const results: LogoCandidate[] = [];
      let failures = 0;

      settled.forEach((outcome, index) => {
        if (outcome.status === 'rejected') {
          failures += 1;
          console.warn(`[logo-search] ${providers[index]?.id ?? 'provider'} failed`);

          return;
        }

        for (const candidate of outcome.value) {
          if (seen.has(candidate.url)) continue;

          seen.add(candidate.url);
          results.push(candidate);
        }
      });

      if (failures === providers.length) {
        throw new AggregateError(
          settled.flatMap((outcome) => (outcome.status === 'rejected' ? [outcome.reason] : [])),
          'Every logo provider failed',
        );
      }

      return results;
    },
  };
}

const FACTORIES: Record<string, () => LogoProvider | null> = {
  'svgl': () => createSvglProvider({ fetchJson }),
  'iconify': () => createIconifyProvider({ fetchJson }),
  'worldvectorlogo': () =>
    createWorldvectorlogoProvider({
      fetchJson,
      ...(env.WORLDVECTORLOGO_KEY ? { apiKey: env.WORLDVECTORLOGO_KEY } : {}),
    }),
  'logo-dev': () =>
    env.LOGODEV_PK ? createLogoDevProvider({ publishableKey: env.LOGODEV_PK }) : null,
};

/**
 * The providers the admin route uses: all of them by default (Logo.dev only
 * with a key), or the comma-separated `LOGO_SEARCH_PROVIDERS` list. `none`
 * disables online search (e2e).
 */
export function createDefaultLogoProvider(): LogoProvider {
  const names = env.LOGO_SEARCH_PROVIDERS
    ? env.LOGO_SEARCH_PROVIDERS.split(',').map((name) => name.trim().toLowerCase())
    : Object.keys(FACTORIES);

  return createAggregateLogoProvider(
    names.flatMap((name) => {
      const provider = FACTORIES[name]?.();

      return provider ? [provider] : [];
    }),
  );
}
