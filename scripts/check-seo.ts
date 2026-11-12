/**
 * Fetches every sitemap URL (no JS) plus a few extra routes and asserts the
 * §13.10 checks. Starts `next start` unless `SEO_BASE_URL` is set.
 *
 * Bun run check:seo.
 */
import { HtmlValidate } from 'html-validate';
import { type ChildProcess, spawn } from 'node:child_process';

import { SESSION_COOKIE } from '@/lib/auth/cookie';
import { isStrongSecret, nowSeconds, signSession } from '@/lib/auth/token';
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX } from '@/lib/seo/text';

const PORT = Number(process.env.SEO_PORT ?? 3101);
const BASE = (process.env.SEO_BASE_URL ?? `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');
const ADMIN_LEAK = /\/admin(?:[/"'\s]|$)/i;

const errors: string[] = [];
function fail(message: string): void {
  errors.push(message);
  console.error(`✗ ${message}`);
}

/**
 * Sitemap locs use the build-time origin; fetch them from this server.
 */
function toFetch(loc: string): string {
  if (loc.startsWith('/')) return loc;

  const url = new URL(loc);

  return `${url.pathname}${url.search}`;
}

async function fetchText(
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; text: string; url: string }> {
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    redirect: 'manual',
    ...init,
    headers: { 'User-Agent': 'check-seo', ...init?.headers },
  });
  const text = await response.text();

  return { response, text, url };
}

function all(html: string, regex: RegExp): string[] {
  return [...html.matchAll(regex)].map((match) => match[1] ?? '');
}

const validator = new HtmlValidate({
  extends: ['html-validate:standard'],
  rules: {
    'no-inline-style': 'off',
    'prefer-native-element': 'off',
    'wcag/h30': 'off',
    'unique-landmark': 'off',
    'heading-level': 'off',
    'require-sri': 'off',
    'script-type': 'off',
    'void-style': 'off',
    'no-trailing-whitespace': 'off',
    'attribute-boolean-style': 'off',
    'attr-quotes': 'off',
    'element-permitted-content': 'off',
    'valid-id': 'off',
    'long-title': 'off',
  },
});

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/en`, { redirect: 'manual' });

      if (response.ok) return;
    } catch {
      // still booting
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Server at ${BASE} did not become ready.`);
}

async function startServer(): Promise<ChildProcess | undefined> {
  if (process.env.SEO_BASE_URL) {
    await waitForServer();

    return undefined;
  }

  const child = spawn('bun', ['run', '--bun', 'next', 'start', '-p', String(PORT)], {
    env: { ...process.env, CONTENT_SOURCE: 'fixtures' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const line = chunk.toString();

    if (line.toLowerCase().includes('error')) process.stderr.write(line);
  });
  await waitForServer();

  return child;
}

async function checkRobotsAndSitemap(): Promise<string[]> {
  const robots = await fetchText('/robots.txt');

  if (robots.response.status !== 200) fail('robots.txt is not 200');

  if (!robots.text.includes('Allow: /')) fail('robots.txt must allow /');

  if (!robots.text.includes('Disallow: /api/')) {
    fail('robots.txt must disallow /api/');
  }

  if (!/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/i.test(robots.text)) {
    fail('robots.txt must reference an absolute sitemap URL');
  }

  if (ADMIN_LEAK.test(robots.text)) fail('robots.txt leaks the admin path');

  const sitemap = await fetchText('/sitemap.xml');

  if (sitemap.response.status !== 200) fail('sitemap.xml is not 200');

  if (ADMIN_LEAK.test(sitemap.text)) fail('sitemap.xml leaks the admin path');

  if (sitemap.text.includes('scratch-pad')) {
    fail('sitemap includes a hidden project');
  }

  const locs = all(sitemap.text, /<loc>([^<]+)<\/loc>/g);

  if (locs.length < 8) fail(`sitemap is too small (${locs.length} URLs)`);

  return locs;
}

async function checkPage(loc: string): Promise<void> {
  const path = new URL(loc).pathname;
  const { response, text } = await fetchText(toFetch(loc));

  if (response.status !== 200) {
    fail(`${path}: status ${response.status}`);

    return;
  }

  if (ADMIN_LEAK.test(text)) fail(`${path}: HTML leaks the admin path`);

  const title = text.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';

  if (!title) fail(`${path}: missing title`);

  if (title.length > TITLE_MAX) {
    fail(`${path}: title is ${title.length} chars (> ${TITLE_MAX})`);
  }

  const description =
    text.match(/<meta(?=[^>]*name="description")[^>]*content="([^"]*)"/i)?.[1]
    ?? text.match(/<meta(?=[^>]*content="([^"]*)")[^>]*name="description"/i)?.[1]
    ?? '';

  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    fail(
      `${path}: description is ${description.length} chars (want ${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`,
    );
  }

  const h1 = all(text, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);

  if (h1.length !== 1) fail(`${path}: expected 1 h1, found ${h1.length}`);

  const canonical =
    text.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1]
    ?? text.match(/<link[^>]*href="([^"]+)"[^>]*rel="canonical"/i)?.[1];

  if (canonical !== loc) fail(`${path}: canonical is ${canonical}`);

  const hreflang = all(text, /<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"/gi);
  for (const tag of ['en', 'pt-BR', 'x-default']) {
    if (!hreflang.includes(tag)) fail(`${path}: missing hreflang ${tag}`);
  }

  const robots =
    text.match(/<meta[^>]*name="robots"[^>]*content="([^"]*)"/i)?.[1]
    ?? text.match(/<meta[^>]*content="([^"]*)"[^>]*name="robots"/i)?.[1]
    ?? '';

  if (/\bnoindex\b/i.test(robots)) fail(`${path}: unexpected noindex`);

  const jsonLd = all(text, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  for (const block of jsonLd) {
    try {
      JSON.parse(block);
    } catch {
      fail(`${path}: JSON-LD is not parseable`);
    }

    if (/"email"|"telephone"|hello@example\.com/.test(block)) {
      fail(`${path}: JSON-LD includes contact details`);
    }
  }

  const images = [...text.matchAll(/<img\b([^>]*)>/gi)];
  for (const [, attrs = ''] of images) {
    if (!/\balt=/i.test(attrs)) fail(`${path}: img without alt`);
  }

  const report = await validator.validateString(text);

  if (!report.valid) {
    const messages = report.results.flatMap((result) =>
      result.messages.map((message) => `${message.ruleId}: ${message.message}`),
    );

    fail(`${path}: html-validate (${messages.slice(0, 3).join('; ')})`);
  }

  // Social previews render (§13.8): each og:image once.
  const ogImage = text.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1];

  if (!ogImage) fail(`${path}: missing og:image`);
  else {
    const imagePath = toFetch(ogImage.replaceAll('&amp;', '&'));

    if (!imageStatus.has(imagePath)) {
      const image = await fetch(`${BASE}${imagePath}`);

      imageStatus.set(imagePath, `${image.status} ${image.headers.get('content-type') ?? ''}`);
      await image.arrayBuffer();
    }

    const result = imageStatus.get(imagePath) ?? '';

    if (!result.startsWith('200 image/png')) {
      fail(`${path}: og:image ${imagePath} → ${result}`);
    }
  }

  // Every internal link on every page, each URL fetched once (§13.10).
  for (const href of all(text, /href="(\/(?:en|pt)(?:\/[^"]*)?)"/g)) {
    const clean = (href.split('#')[0] ?? href).replaceAll('&amp;', '&');
    let status = linkStatus.get(clean);

    if (status === undefined) {
      status = (await fetchText(clean)).response.status;
      linkStatus.set(clean, status);
    }

    if (status >= 400) fail(`${path}: internal link ${clean} → ${status}`);
  }
}

const linkStatus = new Map<string, number>();
const imageStatus = new Map<string, string>();

const NOINDEX = /\bnoindex\b/i;

/**
 * API responses and (with a test session) the admin are never indexable.
 */
async function checkPrivateHeaders(): Promise<void> {
  const api = await fetchText('/api/terminal-content?locale=en');

  if (!NOINDEX.test(api.response.headers.get('x-robots-tag') ?? '')) {
    fail('/api/terminal-content: missing X-Robots-Tag noindex');
  }

  const secret = process.env['SESSION_SECRET'];

  if (!isStrongSecret(secret)) {
    console.warn('! SESSION_SECRET not set: admin header check skipped');

    return;
  }

  const { token } = await signSession(secret, nowSeconds());
  const admin = await fetchText('/admin', {
    headers: { Cookie: `${SESSION_COOKIE}=${token}` },
  });
  const headers = admin.response.headers;

  if (admin.response.status !== 200) {
    fail(`/admin with a test session returned ${admin.response.status}`);
  }

  if (!NOINDEX.test(headers.get('x-robots-tag') ?? '')) {
    fail('/admin: missing X-Robots-Tag noindex');
  }

  if (!/no-store/.test(headers.get('cache-control') ?? '')) {
    fail('/admin: missing Cache-Control no-store');
  }

  if (!NOINDEX.test(admin.text)) fail('/admin: missing robots meta noindex');
}

async function extras(): Promise<void> {
  const hidden = await fetchText('/en/projects/scratch-pad');

  if (hidden.response.status !== 404) {
    fail(`hidden project returned ${hidden.response.status}`);
  }

  const moved = await fetchText('/en/projects/paybridge');

  if (moved.response.status !== 308) {
    fail(`previous slug returned ${moved.response.status} (want 308)`);
  }

  const location = moved.response.headers.get('location') ?? '';

  if (!location.endsWith('/en/projects/pay-bridge')) {
    fail(`previous slug Location is ${location}`);
  }

  const resume = await fetchText('/en/resume');

  if (resume.response.status !== 307) {
    fail(`resume returned ${resume.response.status} (want 307)`);
  }

  const filtered = await fetchText('/en/projects?kind=web');

  if (filtered.response.status !== 200) fail('filtered listing is not 200');

  if (!/noindex/i.test(filtered.text)) {
    fail('filtered listing is missing noindex');
  }

  const canonical = filtered.text.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];

  if (!canonical?.endsWith('/en/projects')) {
    fail(`filtered canonical is ${canonical}`);
  }

  if (ADMIN_LEAK.test(filtered.text)) {
    fail('filtered listing leaks the admin path');
  }

  const unknown = await fetchText('/en/projects/nope');

  if (unknown.response.status !== 404) {
    fail(`unknown slug returned ${unknown.response.status}`);
  }
}

async function checkNotFound(): Promise<void> {
  const paths = ['/zz-nope-123', '/llms.txt', '/.well-known/ard.json', '/__not-found', '/admin'];
  const results = new Map<string, { response: Response; text: string }>();

  for (const path of paths) {
    const result = await fetchText(path);

    results.set(path, result);

    if (result.response.status !== 404) {
      fail(`${path} returned ${result.response.status} (want 404)`);
    }

    if (result.response.headers.has('location')) fail(`${path} redirects instead of 404`);

    // Vercel served the prerendered 404 file as a 200 download (D83).
    if (result.response.headers.has('content-disposition')) {
      fail(`${path} is served as a download (content-disposition)`);
    }

    if (!NOINDEX.test(result.text)) fail(`${path}: 404 page is missing robots meta noindex`);
  }

  const random = results.get('/zz-nope-123');
  const admin = results.get('/admin');

  if (!random || !admin) return;

  if (admin.text !== random.text) fail('anonymous /admin 404 body differs from a random 404');

  for (const header of ['content-type', 'cache-control']) {
    if (admin.response.headers.get(header) !== random.response.headers.get(header)) {
      fail(`anonymous /admin 404 ${header} differs from a random 404`);
    }
  }
}

async function main(): Promise<void> {
  const child = await startServer();

  try {
    const locs = await checkRobotsAndSitemap();
    for (const loc of locs) await checkPage(loc);
    await extras();
    await checkNotFound();
    await checkPrivateHeaders();
  } finally {
    child?.kill('SIGTERM');
  }

  if (errors.length > 0) {
    console.error(`SEO check failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.info(`SEO check passed: sitemap pages and extras look good.`);
}

await main();
