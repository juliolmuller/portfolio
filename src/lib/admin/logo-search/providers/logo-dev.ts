import 'server-only';

import { type LogoCandidate, type LogoProvider } from '../provider';

/**
 * Logo.dev name lookup (raster only, publishable `pk_` key). The CDN answers
 * with the image itself, so "searching" builds the URL; `fallback=404` makes a
 * miss fail the download instead of returning a monogram. The URL carries the
 * key and is downloaded on the server only; the browser gets the re-encoded
 * preview. The free plan requires attribution (shown in the editor, D74).
 */
export function createLogoDevProvider(deps: { publishableKey: string }): LogoProvider {
  return {
    id: 'logo-dev',
    hosts: ['img.logo.dev'],
    search(query): Promise<LogoCandidate[]> {
      const name = encodeURIComponent(query.trim());
      const url = (strategy: string): string =>
        `https://img.logo.dev/name/${name}?token=${encodeURIComponent(deps.publishableKey)}&format=png&size=256&theme=dark&fallback=404&strategy=${strategy}`;

      return Promise.resolve(
        ['match', 'suggest'].map((strategy) => ({
          name: query.trim(),
          source: 'logo-dev',
          sourceId: `logo-dev:${strategy}:${name}`,
          kind: 'icon' as const,
          format: 'raster' as const,
          url: url(strategy),
        })),
      );
    },
  };
}
