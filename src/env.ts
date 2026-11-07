import 'server-only';

import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  NEXT_PUBLIC_SITE_URL: z
    .url({ protocol: /^https?$/ })
    .default('http://localhost:3000')
    .transform((url) => url.replace(/\/+$/, '')),
  CONTENT_SOURCE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['sanity', 'fixtures']).optional(),
  ),
  SANITY_PROJECT_ID: optionalString.pipe(
    z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
  ),
  SANITY_DATASET: optionalString.pipe(
    z
      .string()
      .regex(/^[a-z0-9_-]+$/)
      .optional(),
  ),
  SANITY_API_VERSION: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default('2026-10-01'),
  SANITY_READ_TOKEN: optionalString,
  SANITY_WRITE_TOKEN: optionalString,
  SANITY_WEBHOOK_SECRET: optionalString,
  /**
   * `1` lets the admin write fixtures in production (e2e only).
   */
  ADMIN_FIXTURE_WRITES: optionalString,
  ADMIN_PASSWORD: optionalString,
  ADMIN_PASSWORD_HASH: optionalString,
  SESSION_SECRET: optionalString,
  GOOGLE_SITE_VERIFICATION: optionalString,
  BING_SITE_VERIFICATION: optionalString,
  AI_GATEWAY_API_KEY: optionalString,
  AI_GATEWAY_MODEL: optionalString,
  AI_GATEWAY_BASE_URL: optionalString.pipe(z.url({ protocol: /^https?$/ }).optional()),
  OPENROUTER_API_KEY: optionalString,
  OPENROUTER_MODEL: optionalString,
  OPENROUTER_BASE_URL: optionalString.pipe(z.url({ protocol: /^https?$/ }).optional()),
  AI_PROVIDER_ORDER: optionalString,
  LOGO_SEARCH_ALLOWED_HOSTS: optionalString,
  UPSTASH_REDIS_REST_URL: optionalString.pipe(z.url().optional()),
  UPSTASH_REDIS_REST_TOKEN: optionalString,
});

export type Env = z.infer<typeof schema>;

function parseEnv(): Env {
  const result = schema.safeParse(process.env);

  if (result.success) return result.data;

  // Report variable names and issue codes only, never values.
  const problems = result.error.issues
    .map((issue) => `${issue.path.join('.')} (${issue.code})`)
    .join(', ');
  throw new Error(`Invalid environment configuration: ${problems}`);
}

export const env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';

/**
 * Indexable only on the production deployment (never on previews).
 */
export const isIndexable =
  isProduction && (env.VERCEL_ENV === undefined || env.VERCEL_ENV === 'production');

export const contentSource: 'fixtures' | 'sanity' =
  env.CONTENT_SOURCE ?? (env.SANITY_PROJECT_ID && env.SANITY_DATASET ? 'sanity' : 'fixtures');
