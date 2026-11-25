/**
 * Live smoke test: reads every repository method from Sanity (`SANITY_DATASET`,
 * normally the seeded `development`) and from fixtures, then diffs them. Asset
 * URLs, LQIPs and revision metadata legitimately differ and are normalized;
 * everything else must match.
 *
 * Bun run content:smoke.
 */
import { isDeepStrictEqual } from 'node:util';

import { createRepository } from '@/lib/content/create-repository';
import { createFixtureSource } from '@/lib/content/fixtures/source';
import { type ContentRepository } from '@/lib/content/repository';
import { createSanityHttpFetch } from '@/lib/content/sanity/http';
import { createSanitySource } from '@/lib/content/sanity/source';
import { contentLocales } from '@/lib/content/schema';

const VOLATILE = new Set(['lqip', 'rev', 'updatedAt', 'url']);

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);

  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      VOLATILE.has(key) ? typeof entry : normalize(entry),
    ]),
  );
}

async function read(repository: ContentRepository): Promise<Array<[string, unknown]>> {
  const results: Array<[string, unknown]> = [
    ['getResume', await repository.getResume()],
    ['getProjectRoutes', await repository.getProjectRoutes()],
    ['getProject(paybridge)', await repository.getProject('en', 'paybridge')],
    ['getProject(missing)', await repository.getProject('en', 'nope')],
  ];
  for (const locale of contentLocales) {
    const reads: Array<[string, Promise<unknown>]> = [
      ['getProfile', repository.getProfile(locale)],
      ['getContact', repository.getContact(locale)],
      ['getFeaturedLinks', repository.getFeaturedLinks(locale)],
      ['getRecommendedProfiles', repository.getRecommendedProfiles(locale)],
      ['getProjects', repository.getProjects(locale)],
      ['getProject', repository.getProject(locale, 'orbit-dashboard')],
      ['getExperience', repository.getExperience(locale)],
      ['getEducation', repository.getEducation(locale)],
      ['getTechnologies', repository.getTechnologies(locale)],
      ['getPractices', repository.getPractices(locale)],
      ['getSkills', repository.getSkills(locale)],
    ];
    for (const [name, result] of reads) {
      results.push([`${name}(${locale})`, await result]);
    }
  }

  return results;
}

function firstDifference(a: unknown, b: unknown, at = ''): null | string {
  if (isDeepStrictEqual(a, b)) return null;

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const found = firstDifference(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${at}.${key}`,
      );

      if (found) return found;
    }
  }

  return at || '(root)';
}

const warnings: string[] = [];
const logger = {
  warn: (event: string): void => {
    warnings.push(event);
  },
};
const sanity = await read(createRepository(createSanitySource(createSanityHttpFetch()), logger));
const fixtures = await read(createRepository(createFixtureSource()));

let failures = 0;

sanity.forEach(([name, value], index) => {
  const expected = fixtures[index]?.[1];

  const difference = firstDifference(normalize(value), normalize(expected));

  if (difference) {
    failures += 1;
    console.error(`✗ ${name}: differs at ${difference}`);
  }
});

if (warnings.length > 0) {
  console.error(`✗ content warnings: ${[...new Set(warnings)].join(', ')}`);
  failures += 1;
}

if (failures > 0) {
  console.error(`Content smoke test failed (${failures}).`);
  process.exit(1);
}

console.info(`Content smoke test passed: ${sanity.length} reads match.`);
