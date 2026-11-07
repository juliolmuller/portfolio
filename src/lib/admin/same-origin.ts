import { type NextRequest } from 'next/server';

/**
 * Same-origin browser requests only: Origin and Sec-Fetch-Site must agree.
 */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  if (fetchSite && fetchSite !== 'same-origin') return false;

  if (origin === null) return false;

  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false; // `Origin: null` or malformed
  }
}
