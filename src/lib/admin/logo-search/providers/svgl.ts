import 'server-only';

import { z } from 'zod';

import { type FetchJson, type LogoCandidate, type LogoProvider } from '../provider';
import { searchTerms } from '../terms';

const themed = z.union([z.url(), z.object({ light: z.url(), dark: z.url() })]);
const answer = z.array(
  z.object({ id: z.number(), title: z.string(), route: themed, wordmark: themed.optional() }),
);

type Themed = z.infer<typeof themed>;

/**
 * Svgl.app (no key): titles match by substring, so "node" finds "Node.js" but
 * "nodejs" does not; three spellings are tried. A 404 means no match.
 */
export function createSvglProvider(deps: { fetchJson: FetchJson }): LogoProvider {
  return {
    id: 'svgl',
    hosts: ['svgl.app'],
    async search(query, signal): Promise<LogoCandidate[]> {
      const answers = await Promise.all(
        searchTerms(query)
          .slice(0, 3)
          .map((term) =>
            deps.fetchJson(`https://api.svgl.app?search=${encodeURIComponent(term)}`, answer, {
              notFoundAs: [],
              ...(signal ? { signal } : {}),
            }),
          ),
      );

      // Several spellings often return the same entry.
      const unique = [...new Map(answers.flat().map((item) => [item.id, item])).values()];

      return unique.flatMap((item): LogoCandidate[] => {
        const base = { name: item.title, source: 'svgl', sourceId: `svgl:${item.id}` };
        const files = (value: Themed | undefined, kind: LogoCandidate['kind']): LogoCandidate[] =>
          value === undefined
            ? []
            : typeof value === 'string'
              ? [{ ...base, kind, format: 'svg', url: value }]
              : (['dark', 'light'] as const).map((theme) => ({
                  ...base,
                  kind,
                  theme,
                  format: 'svg',
                  url: value[theme],
                }));

        return [...files(item.route, 'icon'), ...files(item.wordmark, 'wordmark')];
      });
    },
  };
}
