import 'server-only';

import { type z } from 'zod';

export type LogoKind = 'icon' | 'unknown' | 'wordmark';

/**
 * One downloadable logo file a provider found. `url` is a direct file link on
 * one of the provider's `hosts`; it is downloaded only through the hardened
 * fetcher (D73).
 */
export interface LogoCandidate {
  format: 'raster' | 'svg';
  kind: LogoKind;
  /**
   * Provider title, e.g. "Node.js".
   */
  name: string;
  source: string;
  /**
   * Stable per provider, e.g. `svgl:446` or `logos:nodejs-icon`.
   */
  sourceId: string;
  theme?: 'dark' | 'light';
  url: string;
}

/**
 * A logo source. `search` throws when the provider fails; an empty array means
 * it answered with nothing.
 */
export interface LogoProvider {
  /**
   * Hosts the candidate files live on: the download allowlist.
   */
  readonly hosts: readonly string[];
  readonly id: string;
  search: (query: string, signal?: AbortSignal) => Promise<LogoCandidate[]>;
}

export type FetchJson = <T>(
  url: string,
  schema: z.ZodType<T>,
  options?: { headers?: Record<string, string>; notFoundAs?: T; signal?: AbortSignal },
) => Promise<T>;

const TIMEOUT_MS = 6000;

/**
 * GET to a provider's fixed API host (a constant in code, never a supplied
 * URL). Non-2xx and schema mismatches throw; `notFoundAs` turns a 404 into an
 * empty answer for APIs that use it for "no results".
 */
export const fetchJson: FetchJson = async (url, schema, options = {}) => {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'juliolmuller.com-logo-search', ...options.headers },
    cache: 'no-store',
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  });

  if (response.status === 404 && options.notFoundAs !== undefined) {
    await response.body?.cancel();

    return options.notFoundAs;
  }

  if (!response.ok) {
    await response.body?.cancel();

    throw new Error(`HTTP ${response.status}`);
  }

  return schema.parse(await response.json());
};
