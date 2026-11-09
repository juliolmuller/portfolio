import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createDefaultLogoProvider } from '@/lib/admin/logo-search/aggregate';
import { createRemoteIconFetcher } from '@/lib/admin/logo-search/remote-icon';
import { createLogoSearch } from '@/lib/admin/logo-search/search';
import { createWindowCounter } from '@/lib/admin/rate';
import { sameOrigin } from '@/lib/admin/same-origin';
import { requireAdmin } from '@/lib/auth/session';

export const maxDuration = 30;

const allowed = createWindowCounter(30, 10 * 60_000);
const body = z.object({ query: z.string().trim().min(2).max(64) });
const headers = { 'Cache-Control': 'no-store' };

const fail = (status: number, error: string): NextResponse =>
  NextResponse.json({ error }, { status, headers });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await requireAdmin();

  if (!sameOrigin(request)) return fail(403, 'Cross-origin request refused');

  if (!allowed(String(session.start))) return fail(429, 'Too many searches, try again later');

  const parsed = body.safeParse(await request.json().catch(() => null));

  if (!parsed.success) return fail(400, 'Send a query of 2 to 64 characters');

  const provider = createDefaultLogoProvider();
  const search = createLogoSearch({
    provider,
    fetcher: createRemoteIconFetcher({ allowedHosts: new Set(provider.hosts) }),
  });

  return NextResponse.json(await search(parsed.data.query, request.signal), { headers });
}
