import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createRemoteIconFetcher } from '@/lib/admin/logo-search/remote-icon';
import { createWindowCounter } from '@/lib/admin/rate';
import { sameOrigin } from '@/lib/admin/same-origin';
import { requireAdmin } from '@/lib/auth/session';

export const maxDuration = 15;

const allowed = createWindowCounter(20, 10 * 60_000);
const body = z.object({ url: z.string().trim().min(1).max(2048) });
const headers = { 'Cache-Control': 'no-store' };

const fail = (status: number, error: string): NextResponse =>
  NextResponse.json({ error }, { status, headers });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await requireAdmin();

  if (!sameOrigin(request)) return fail(403, 'Cross-origin request refused');

  if (!allowed(String(session.start))) return fail(429, 'Too many imports, try again later');

  const parsed = body.safeParse(await request.json().catch(() => null));

  if (!parsed.success) return fail(400, 'Send a URL');

  // Any public https host (D73): the owner typed it; every other check still applies.
  const result = await createRemoteIconFetcher().fetch(parsed.data.url, request.signal);

  return result.ok
    ? NextResponse.json({ svg: result.svg }, { headers })
    : fail(422, result.message);
}
