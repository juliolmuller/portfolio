import 'server-only';

import { z } from 'zod';

import { type FetchJson, type LogoCandidate, type LogoProvider } from '../provider';
import { searchTerms } from '../terms';

const answer = z.object({ icons: z.array(z.string()) });
const NAME = /^([a-z0-9-]+):([a-z0-9-]+)$/;

/**
 * Iconify's `logos` set (no key). `simple-icons` and `devicon` are left out:
 * the editor already lists them from the bundled catalogs. Search is by
 * keyword, so "node.js" misses while "nodejs" hits; two spellings are tried.
 */
export function createIconifyProvider(deps: { fetchJson: FetchJson }): LogoProvider {
  return {
    id: 'iconify',
    hosts: ['api.iconify.design'],
    async search(query, signal): Promise<LogoCandidate[]> {
      const answers = await Promise.all(
        // shortcut: Iconify's CDN rate-limits per IP (Cloudflare 1015 seen in testing), so
        // only two spellings; fetch bodies in one `/{prefix}.json?icons=` call if it bites.
        searchTerms(query)
          .slice(0, 2)
          .map((term) =>
            deps.fetchJson(
              `https://api.iconify.design/search?query=${encodeURIComponent(term)}&prefixes=logos&limit=32`,
              answer,
              signal ? { signal } : {},
            ),
          ),
      );

      return [...new Set(answers.flatMap((item) => item.icons))].flatMap(
        (full): LogoCandidate[] => {
          const [, prefix, name] = NAME.exec(full) ?? [];

          if (!prefix || !name) return [];

          return [
            {
              name: name.replaceAll('-', ' '),
              source: 'iconify',
              sourceId: full,
              kind: name.endsWith('-wordmark') ? 'wordmark' : 'icon',
              format: 'svg',
              url: `https://api.iconify.design/${prefix}/${name}.svg`,
            },
          ];
        },
      );
    },
  };
}
