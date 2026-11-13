import { type NextRequest, NextResponse } from 'next/server';

import { negotiateLocale } from '@/i18n/negotiate';
import { isAppLocale, LOCALE_COOKIE } from '@/i18n/routing';
import { SESSION_COOKIE, sessionCookie } from '@/lib/auth/cookie';
import {
  isStrongSecret,
  nowSeconds,
  RENEW_AFTER_SECONDS,
  signSession,
  verifySession,
} from '@/lib/auth/token';
import { adminCsp, isHttpsSite } from '@/lib/security/headers';

/**
 * Rewrite target for every request that must produce the global 404. Its first
 * segment is not a locale, so the `[locale]` root layout guard calls
 * `notFound()`. It must never be `/404` (or any path with a build output): on
 * Vercel a rewrite to the prerendered file serves it with status 200 (D83).
 */
const NOT_FOUND_PATH = '/__not-found';

/**
 * Root-level files and route trees that are not localized.
 */
const ROOT_PASSTHROUGH = new Set([
  'api',
  'apple-icon',
  'fixtures',
  'icon',
  'icon.svg',
  'llms.txt',
  'manifest.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'tech-icons',
]);

const isProduction = process.env.NODE_ENV === 'production';
const securityOptions = {
  dev: process.env.NODE_ENV === 'development',
  https: isHttpsSite(process.env['NEXT_PUBLIC_SITE_URL']),
};

function notFound(request: NextRequest): NextResponse<unknown> {
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
}

const ADMIN_HEADERS = {
  'X-Robots-Tag':
    'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, noai, noimageai',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
};

/**
 * No valid session means the same global 404 as any unknown path, so these
 * headers (which would reveal the area) are only set on the allowed branch.
 */
async function guardAdmin(request: NextRequest): Promise<NextResponse<unknown>> {
  const secret = process.env['SESSION_SECRET'];
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = isStrongSecret(secret) && token ? await verifySession(secret, token) : null;

  if (!isStrongSecret(secret) || !session) return notFound(request);

  // Next reads the nonce from the request's CSP header and stamps it on its
  // own scripts and styles while rendering the (dynamic) admin tree.
  const nonce = btoa(crypto.randomUUID());
  const csp = adminCsp(nonce, securityOptions);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', csp);
  for (const [name, value] of Object.entries(ADMIN_HEADERS)) {
    response.headers.set(name, value);
  }

  // Sliding renewal at most once a minute; session checks (actions) never extend it.
  if (!request.headers.has('next-action') && nowSeconds() - session.iat >= RENEW_AFTER_SECONDS) {
    const next = await signSession(secret, session.start);

    response.cookies.set(sessionCookie(next.token, next.exp));
  }

  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse<unknown>> {
  const { pathname, search } = request.nextUrl;

  const lowercased = pathname.toLowerCase();

  if (lowercased !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = lowercased;

    return NextResponse.redirect(url, 308);
  }

  if (pathname === '/') {
    const locale = negotiateLocale(
      request.cookies.get(LOCALE_COOKIE)?.value,
      request.headers.get('accept-language'),
    );
    const response = NextResponse.redirect(new URL(`/${locale}${search}`, request.url), 307);

    response.headers.set('Vary', 'Accept-Language, Cookie');
    response.headers.set('Cache-Control', 'private, no-store');

    return response;
  }

  const firstSegment = pathname.split('/')[1] ?? '';

  if (isAppLocale(firstSegment) || ROOT_PASSTHROUGH.has(firstSegment)) {
    return NextResponse.next();
  }

  if (firstSegment === 'admin') return guardAdmin(request);

  if (firstSegment === 'dev' && !isProduction) {
    return NextResponse.next();
  }

  return notFound(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_vercel).*)'],
};
