/**
 * Copies technologies and practices into skills and links them from projects
 * and experience (D93, #65). Re-runnable: it only creates missing skills and
 * appends missing references; it never modifies or deletes technologies,
 * practices or existing skills.
 *
 * Bun run skills:migrate --dataset development # dry run (default) bun run
 * skills:migrate --dataset development --apply bun run skills:migrate --dataset
 * development --check # exit 1 if work is left bun run skills:migrate --dataset
 * production --apply --force.
 */
import { createClient, type SanityClient } from '@sanity/client';
import { parseArgs } from 'node:util';

import { env } from '@/env';
import { loadSkillCopyInput, type SkippedDocument } from '@/lib/content/migrations/input';
import { isPlanComplete, planSkillCopy, type SkillCopyPlan } from '@/lib/content/migrations/plan';
import { references, toSanityDocument } from '@/lib/content/sanity/documents';

const { values: args } = parseArgs({
  options: {
    dataset: { type: 'string' },
    apply: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const dataset = args.dataset ?? env.SANITY_DATASET;
// A dry run and `--check` only read, so they prefer the read-only token.
const token = args.apply
  ? env.SANITY_WRITE_TOKEN
  : (env.SANITY_READ_TOKEN ?? env.SANITY_WRITE_TOKEN);

if (args.apply && args.check) fail('--apply and --check cannot be combined.');

if (!env.SANITY_PROJECT_ID) fail('SANITY_PROJECT_ID is not set.');

if (!dataset) fail('Pass --dataset or set SANITY_DATASET.');

if (!/^[a-z0-9_-]+$/.test(dataset)) fail('Invalid dataset name.');

if (args.apply && dataset === 'production' && !args.force) {
  fail('Refusing to write to "production" without --force.');
}

if (args.apply && !env.SANITY_WRITE_TOKEN) fail('SANITY_WRITE_TOKEN is not set.');

if (!token) fail('SANITY_READ_TOKEN or SANITY_WRITE_TOKEN is not set.');

const client: SanityClient = createClient({
  projectId: env.SANITY_PROJECT_ID,
  dataset,
  apiVersion: env.SANITY_API_VERSION,
  token,
  useCdn: false,
  perspective: 'published',
});

const noAssets = {
  image: (): string => fail('A skill cannot hold an image.'),
  file: (): string => fail('A skill cannot hold a file.'),
};

function section(title: string, lines: string[]): void {
  if (lines.length === 0) return;

  console.info(`\n${title}`);
  for (const line of lines) console.info(`  ${line}`);
}

function report(plan: SkillCopyPlan, skipped: SkippedDocument[]): void {
  const linked = (type: 'experience' | 'project'): number =>
    plan.link.filter((item) => item.type === type).length;
  const names = new Map(plan.create.map((item) => [item.skill.id, item.skill.name.en]));

  section(
    `Create ${plan.create.length} skills`,
    plan.create.map((item) => `${item.skill.name.en} (${item.sourceType} ${item.sourceId})`),
  );
  section(
    `Link ${linked('project')} projects and ${linked('experience')} experience entries`,
    plan.link.map(
      (item) =>
        `${item.type} ${item.id}: +${item.added.length} (${item.added
          .map((id) => names.get(id) ?? id)
          .join(', ')})`,
    ),
  );
  section(
    'Overflow (not linked, over the limit)',
    plan.overflow.map(
      (item) =>
        `${item.type} ${item.id}: ${item.current} stored + ${item.missing} missing > ${item.cap}`,
    ),
  );
  section(
    'Unresolved (skill missing, not linked)',
    plan.unresolved.map((item) => `${item.type} ${item.id}: ${item.skillIds.join(', ')}`),
  );
  section(
    'Invalid sources (not copied)',
    plan.invalid.map((item) => `${item.sourceId}: ${item.message}`),
  );
  section(
    'Skipped documents (invalid fields)',
    skipped.map((item) => `${item.type} ${item.id}: ${item.paths.join(', ')}`),
  );
  section(
    'Drift (copy differs from its source; informational)',
    plan.drift.map(
      (item) =>
        `${item.sourceId} → ${item.skillId}: ${item.fields.join(', ')} (source ${item.sourceUpdatedAt}, copy ${item.skillUpdatedAt})`,
    ),
  );
  section(
    'Name collisions (informational)',
    plan.collisions.map(
      (item) =>
        `"${item.key}": ${item.entries.map((entry) => `${entry.type} ${entry.id}`).join(', ')}`,
    ),
  );
}

function isConflict(error: unknown): boolean {
  return (error as { statusCode?: number } | null)?.statusCode === 409;
}

async function load(): Promise<Awaited<ReturnType<typeof loadSkillCopyInput>>> {
  return loadSkillCopyInput((query) => client.fetch(query));
}

async function apply(plan: SkillCopyPlan): Promise<boolean> {
  for (let start = 0; start < plan.create.length; start += 100) {
    const transaction = client.transaction();

    for (const item of plan.create.slice(start, start + 100)) {
      transaction.createIfNotExists(toSanityDocument('skill', item.skill, noAssets));
    }

    await transaction.commit({ tag: 'skills.migrate', visibility: 'sync' });
  }

  let conflicts = 0;

  for (const item of plan.link) {
    const patch = client.patch(item.id);

    if (item.rev) patch.ifRevisionId(item.rev);

    try {
      await client
        .transaction()
        .patch(patch.set({ skills: references(item.id, 'skills', item.skillIds) }))
        .commit({ tag: 'skills.migrate', visibility: 'sync' });
    } catch (error) {
      if (isConflict(error)) {
        conflicts += 1;
        console.error(`✗ ${item.type} ${item.id} changed since it was read; re-run.`);
        continue;
      }

      throw error;
    }
  }

  return conflicts === 0;
}

async function main(): Promise<void> {
  const mode = args.apply ? 'apply' : args.check ? 'check' : 'dry run';

  console.info(`Dataset: ${dataset} · mode: ${mode}`);

  const { input, skipped } = await load();
  const plan = planSkillCopy(input, new Date().toISOString());

  report(plan, skipped);

  if (args.check) {
    if (isPlanComplete(plan) && skipped.length === 0) {
      console.info('\n✓ Nothing left to do.');

      return;
    }

    fail(
      skipped.length > 0
        ? 'Some documents were skipped (invalid fields) or skills are missing or not linked. Fix the skipped documents, then run with --apply.'
        : 'Skills are missing or not linked. Run with --apply.',
    );
  }

  if (!args.apply) {
    console.info('\nDry run: nothing written. Re-run with --apply.');

    return;
  }

  const clean = await apply(plan);
  const reloaded = await load();
  const after = planSkillCopy(reloaded.input, new Date().toISOString());

  console.info(
    isPlanComplete(after) && reloaded.skipped.length === 0
      ? '\n✓ Nothing left to do.'
      : `\nLeft to do: ${after.create.length} skills, ${after.link.length} links, ${after.overflow.length} overflow, ${after.unresolved.length} unresolved, ${after.invalid.length} invalid, ${reloaded.skipped.length} skipped.`,
  );
  console.info('Then press "Revalidate all public pages" in the admin dashboard.');

  if (!clean) process.exit(1);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : 'Migration failed.');
});
