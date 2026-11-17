import { revalidatePath, revalidateTag } from 'next/cache';

import { env } from '@/env';
import { createWindowCounter } from '@/lib/admin/rate';
import { isDocumentType } from '@/lib/content/schema';
import { tagsForDocument } from '@/lib/content/tags';
import { isValidWebhookSignature, SIGNATURE_HEADER } from '@/lib/content/webhook';

const allowed = createWindowCounter(60, 60_000);
const MAX_BODY = 64 * 1024;

/**
 * Anything that is not a valid, signed webhook gets the same bare 404.
 */
const nothing = (): Response => new Response(null, { status: 404 });

export async function POST(request: Request): Promise<Response> {
  const secret = env.SANITY_WEBHOOK_SECRET;
  const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (!secret || !allowed(client)) return nothing();

  const body = await request.text();

  if (
    body.length > MAX_BODY
    || !isValidWebhookSignature(body, request.headers.get(SIGNATURE_HEADER), secret)
  ) {
    return nothing();
  }

  let payload: { _type?: unknown; slug?: unknown };

  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    return nothing();
  }

  const type = String(payload._type);

  if (!isDocumentType(type)) return nothing();

  const slugs = typeof payload.slug === 'string' ? [payload.slug] : [];
  const tags = tagsForDocument(type, slugs);
  for (const tag of tags) revalidateTag(tag, 'max');
  revalidatePath('/sitemap.xml');

  return Response.json({ revalidated: tags });
}
