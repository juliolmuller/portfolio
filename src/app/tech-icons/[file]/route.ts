import { getContent } from '@/lib/content';
import { iconHash, renderIconSvg, renderImageIconSvg } from '@/lib/content/icon-src';
import { imageAlphaMask } from '@/lib/content/icons/image-mask';

const FILE = /^([0-9a-z]{14})\.svg$/;
const FILL = /^[0-9a-f]{6}$/;

const notFound = (): Response => new Response(null, { status: 404 });

/**
 * Content-addressed technology logos (D59). The name is a hash of the paths, so
 * a changed icon gets a new URL and each file can be cached forever. Only
 * visible technologies resolve. The document holds nothing but `<path>`
 * elements built from sanitized data (D54), or a mask over a re-encoded PNG
 * (D75), so it cannot carry script.
 */
export async function GET(
  request: Request,
  context: RouteContext<'/tech-icons/[file]'>,
): Promise<Response> {
  const { file } = await context.params;
  const hash = FILE.exec(file)?.[1];

  if (!hash) return notFound();

  const fill = new URL(request.url).searchParams.get('fill') ?? undefined;

  if (fill !== undefined && !FILL.test(fill)) return notFound();

  const technologies = await getContent().getTechnologies('en');
  const icon = technologies
    .map((tech) => tech.icon)
    .find((candidate) => !('monogram' in candidate) && iconHash(candidate) === hash);

  if (!icon || 'monogram' in icon) return notFound();

  let body: string;

  if ('image' in icon) {
    const mask = await imageAlphaMask(icon.image);

    if (!mask) return new Response(null, { status: 502 });

    body = renderImageIconSvg(mask, fill);
  } else {
    body = renderIconSvg(icon, fill);
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
