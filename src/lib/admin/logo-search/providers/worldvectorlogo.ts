import 'server-only';

import { z } from 'zod';

import { type FetchJson, type LogoCandidate, type LogoProvider } from '../provider';

const answer = z.object({
  data: z.array(z.object({ slug: z.string(), name: z.string(), svg_url: z.url() })),
});

/**
 * Worldvectorlogo: 10 requests a day per IP without a key, 1,000 credits a
 * month with one (`Authorization: Bearer`). Only the typed name is sent, to
 * spend one request per search.
 */
export function createWorldvectorlogoProvider(deps: {
  apiKey?: string;
  fetchJson: FetchJson;
}): LogoProvider {
  return {
    id: 'worldvectorlogo',
    hosts: ['cdn.worldvectorlogo.com'],
    async search(query, signal): Promise<LogoCandidate[]> {
      const result = await deps.fetchJson(
        `https://worldvectorlogo.com/api/v1/logos/search?q=${encodeURIComponent(query.trim())}`,
        answer,
        {
          ...(deps.apiKey ? { headers: { Authorization: `Bearer ${deps.apiKey}` } } : {}),
          ...(signal ? { signal } : {}),
        },
      );

      return result.data.map((item) => ({
        name: item.name,
        source: 'worldvectorlogo',
        sourceId: `worldvectorlogo:${item.slug}`,
        kind: 'unknown' as const,
        format: 'svg' as const,
        url: item.svg_url,
      }));
    },
  };
}
