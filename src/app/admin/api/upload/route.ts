import { notFound } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';

import { createWindowCounter } from '@/lib/admin/rate';
import { sameOrigin } from '@/lib/admin/same-origin';
import { MAX_IMAGE_BYTES, processImage, sniffImage } from '@/lib/admin/upload/image';
import { checkPdf, MAX_PDF_BYTES } from '@/lib/admin/upload/pdf';
import { getSession } from '@/lib/auth/session';
import { getAdminStore } from '@/lib/content/admin';

const allowed = createWindowCounter(60, 10 * 60_000);
const MULTIPART_OVERHEAD = 64 * 1024;
const MB = 1024 * 1024;

const fail = (status: number, error: string): NextResponse<{ error: string }> =>
  NextResponse.json({ error }, { status });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();

  if (!session) notFound();

  if (!sameOrigin(request)) return fail(403, 'Cross-origin request refused');

  if (!allowed(String(session.start))) return fail(429, 'Too many uploads, try again later');

  // A missing length is unknown, not zero: refuse rather than buffer it all.
  const length = Number(request.headers.get('content-length'));

  if (!Number.isFinite(length) || length <= 0) return fail(411, 'Content-Length required');

  if (length > MAX_PDF_BYTES + MULTIPART_OVERHEAD) return fail(413, 'File too large');

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const kind = form?.get('kind');

  if (!(file instanceof File) || (kind !== 'image' && kind !== 'pdf')) {
    return fail(400, 'Send a file and a kind (image or pdf)');
  }

  const store = getAdminStore();

  if (store.readOnlyReason) return fail(403, store.readOnlyReason);

  if (kind === 'pdf') {
    if (file.size > MAX_PDF_BYTES) return fail(413, `PDFs can be up to ${MAX_PDF_BYTES / MB} MB`);

    const bytes = Buffer.from(await file.arrayBuffer());
    const check = checkPdf(bytes);

    if (!check.ok) return fail(415, check.message);

    const asset = await store.uploadFile(bytes, {
      filename: 'resume.pdf',
      contentType: 'application/pdf',
    });

    return NextResponse.json({ kind: 'file', asset });
  }

  if (file.size > MAX_IMAGE_BYTES)
    return fail(413, `Images can be up to ${MAX_IMAGE_BYTES / MB} MB`);

  const input = Buffer.from(await file.arrayBuffer());
  const format = sniffImage(input);

  if (!format) return fail(415, 'Use a JPEG, PNG, WebP or AVIF image');

  try {
    const image = await processImage(input, format, file.name);
    const asset = await store.uploadImage(image.bytes, {
      filename: image.filename,
      contentType: image.contentType,
    });

    return NextResponse.json({ kind: 'image', asset });
  } catch {
    return fail(415, 'That image could not be read');
  }
}
