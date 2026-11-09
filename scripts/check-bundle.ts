/**
 * Client bundle checks (SPEC §15, §16, §18) against the last `next build`:
 *
 * - First-load JS budgets per public route (gzip), from Next's own
 *   `.next/diagnostics/route-bundle-stats.json`;
 * - Lazy chunk budgets (terminal, secret commands, tech sphere);
 * - Public routes never load admin code and no chunk outside the admin's first
 *   load mentions the admin path;
 * - The secret commands stay out of every first load and the terminal chunk;
 * - No server-only variable name or value appears in any client file.
 *
 *   Bun run build && bun run check:bundle.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const STATIC_DIR = '.next/static';
const STATS = '.next/diagnostics/route-bundle-stats.json';
const KB = 1024;

/**
 * First-load budgets in KB gzip. The framework floor (Next 16.4 + React 19.3,
 * measured on `/_not-found`) is ~136 KB, so the §16 150 KB figure is not
 * reachable with Motion and next-intl on the client; these ceilings guard
 * against regressions instead (D58).
 */
const ROUTE_BUDGETS: Record<string, number> = {
  '/[locale]': 195,
  '/[locale]/projects': 190,
  '/[locale]/projects/[slug]': 190,
  '/[locale]/accessibility': 185,
  '/[locale]/[...rest]': 185,
};

/**
 * Lazy chunks: the chunks outside every first load that contain a string from
 * their source. `exclusive` markers must not appear in any public first load.
 */
const LAZY = {
  terminal: { marker: 'terminal.outputLabel', budget: 20, exclusive: true },
  secret: { marker: 'session expired', budget: 3, exclusive: true },
  sphere: { marker: '[data-cloud-item]', budget: 10, exclusive: false },
} as const;

const SERVER_ONLY_VARS = [
  'SANITY_WRITE_TOKEN',
  'SANITY_READ_TOKEN',
  'ADMIN_PASSWORD',
  'ADMIN_PASSWORD_HASH',
  'SESSION_SECRET',
  'SANITY_WEBHOOK_SECRET',
  'LOGODEV_PK',
  'WORLDVECTORLOGO_KEY',
];

const ADMIN_PATH = /["'`]\/admin(?:[/"'`?]|$)/;
// The analytics filter in ClickTracker (`url.includes('/admin')`) must ship
// publicly to drop admin page views; it is not a route reference.
const ANALYTICS_FILTER = /\.includes\((["'`])\/admin\1\)/g;
const mentionsAdmin = (text: string): boolean =>
  ADMIN_PATH.test(text.replace(ANALYTICS_FILTER, ''));

interface RouteStats {
  firstLoadChunkPaths: string[];
  route: string;
}

const errors: string[] = [];
const fail = (message: string): void => {
  errors.push(message);
  console.error(`✗ ${message}`);
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const contents = new Map<string, string>();
const read = (path: string): string => {
  let text = contents.get(path);

  if (text === undefined) {
    text = readFileSync(path, 'utf8');
    contents.set(path, text);
  }

  return text;
};
const gzip = (path: string): number => gzipSync(readFileSync(path)).length;
const kb = (bytes: number): string => `${(bytes / KB).toFixed(1)} KB`;
const normalize = (path: string): string => path.replace(/^\.next\//, '');

const stats = JSON.parse(readFileSync(STATS, 'utf8')) as RouteStats[];
const isAdmin = (route: string): boolean => route.startsWith('/admin');
const publicRoutes = stats.filter(
  (r) => r.route.startsWith('/[locale]') || r.route === '/_not-found',
);
const firstLoad = (routes: RouteStats[]): Set<string> =>
  new Set(routes.flatMap((r) => r.firstLoadChunkPaths.map(normalize)));
const publicChunks = firstLoad(publicRoutes);
const adminChunks = firstLoad(stats.filter((r) => isAdmin(r.route)));

const clientFiles = walk(STATIC_DIR).filter((path) => /\.(?:js|css|json|txt|map)$/.test(path));
const jsChunks = clientFiles.filter((path) => path.endsWith('.js'));

// 1. First-load budgets.
console.info('First-load JS (gzip):');
for (const { route, firstLoadChunkPaths } of stats) {
  const total = firstLoadChunkPaths.reduce((sum, p) => sum + gzip(p), 0);
  const budget = ROUTE_BUDGETS[route];

  console.info(`  ${route.padEnd(30)} ${kb(total).padStart(10)}${budget ? ` / ${budget} KB` : ''}`);

  if (budget && total > budget * KB) {
    fail(`${route} first load is ${kb(total)}, over its ${budget} KB budget`);
  }
}
for (const route of Object.keys(ROUTE_BUDGETS)) {
  if (!stats.some((r) => r.route === route)) {
    fail(`no bundle stats for ${route}; update ROUTE_BUDGETS`);
  }
}

// 2. Lazy chunks.
console.info('Lazy chunks (gzip):');

const lazyFiles: Record<string, string[]> = {};
for (const [name, { marker, budget, exclusive }] of Object.entries(LAZY)) {
  const files = jsChunks.filter(
    (path) =>
      read(path).includes(marker)
      && !publicChunks.has(normalize(path))
      && !adminChunks.has(normalize(path)),
  );

  lazyFiles[name] = files.map(normalize);

  if (files.length === 0) {
    fail(`no chunk contains the ${name} marker "${marker}"`);
    continue;
  }

  const total = files.reduce((sum, p) => sum + gzip(p), 0);

  console.info(`  ${name.padEnd(30)} ${kb(total).padStart(10)} / ${budget} KB`);

  if (total > budget * KB) {
    fail(`${name} chunk is ${kb(total)}, over its ${budget} KB budget`);
  }

  if (exclusive) {
    for (const file of publicChunks) {
      if (read(`.next/${file}`).includes(marker)) {
        fail(`${name} code is in a public first load: ${file}`);
      }
    }
  }
}
for (const file of lazyFiles['secret'] ?? []) {
  if ((lazyFiles['terminal'] ?? []).includes(file)) {
    fail('the secret commands share a chunk with the terminal');
  }
}

// 3. Admin isolation.
for (const file of publicChunks) {
  if (adminChunks.has(file) && ADMIN_PATH.test(read(`.next/${file}`))) {
    fail(`public first load shares an admin chunk: ${file}`);
  }
}
for (const path of jsChunks) {
  if (!adminChunks.has(normalize(path)) && mentionsAdmin(read(path))) {
    fail(`${normalize(path)} mentions the admin path outside the admin`);
  }
}

// 4. Server-only names and values.
const values = SERVER_ONLY_VARS.map((name) => process.env[name]).filter(
  (value): value is string => typeof value === 'string' && value.length >= 8,
);
for (const path of clientFiles) {
  const text = read(path);
  for (const name of SERVER_ONLY_VARS) {
    if (text.includes(name)) fail(`${normalize(path)} contains ${name}`);
  }
  for (const value of values) {
    if (text.includes(value)) {
      fail(`${normalize(path)} contains a server-only value`);
    }
  }
}
console.info(
  `Scanned ${clientFiles.length} client files for ${SERVER_ONLY_VARS.length} names and ${values.length} values.`,
);

if (errors.length > 0) {
  console.error(`\n${errors.length} bundle check(s) failed.`);
  process.exit(1);
}

console.info('\nBundle checks passed.');
