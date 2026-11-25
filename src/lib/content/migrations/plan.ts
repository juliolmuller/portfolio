import { type PracticeDocument, type SkillDocument, type TechnologyDocument } from '../schema';
import { slugify } from '../slugify';
import { mapTechIds, practiceToSkill, skillIdFor, technologyToSkill } from './skills';

/**
 * Pure planner for `skills:migrate` (#65, D93); also used by the dashboard
 * check (#68). No I/O: it takes parsed documents and returns what a copy run
 * would write. It never mutates its input and never plans a change to a
 * technology, practice or existing skill.
 */

/**
 * Same as the `skillIds` maximums in `projectSchema` and `experienceSchema`.
 */
export const OWNER_SKILL_CAPS = { project: 32, experience: 48 } as const;

export type SkillOwnerType = keyof typeof OWNER_SKILL_CAPS;

export interface SkillOwnerRef {
  id: string;
  rev?: string | undefined;
  skillIds: string[];
  techIds: string[];
}

export interface SkillCopyInput {
  experience: SkillOwnerRef[];
  practices: PracticeDocument[];
  projects: SkillOwnerRef[];
  skills: SkillDocument[];
  technologies: TechnologyDocument[];
}

interface OwnerEntry {
  id: string;
  type: SkillOwnerType;
}

export interface SkillCopyPlan {
  collisions: Array<{
    entries: Array<{ id: string; name: string; type: 'practice' | 'skill' | 'technology' }>;
    key: string;
  }>;
  create: Array<{
    skill: SkillDocument;
    sourceId: string;
    sourceType: 'practice' | 'technology';
  }>;
  drift: Array<{
    fields: string[];
    skillId: string;
    skillUpdatedAt: string;
    sourceId: string;
    sourceUpdatedAt: string;
  }>;
  invalid: Array<{ message: string; sourceId: string }>;
  link: Array<
    {
      added: string[];
      rev?: string | undefined;
      /**
       * The complete new list: existing ids in stored order, then `added`.
       */
      skillIds: string[];
    } & OwnerEntry
  >;
  overflow: Array<{ cap: number; current: number; missing: number } & OwnerEntry>;
  unresolved: Array<{ skillIds: string[] } & OwnerEntry>;
}

const COPIED_FIELDS = [
  'name',
  'categories',
  'iconSource',
  'iconSlug',
  'customSvg',
  'monogram',
  'showInCloud',
  'brandColor',
  'url',
  'priority',
  'order',
  'visible',
] as const;

/**
 * Key-order independent form, with `undefined` treated as absent.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));

    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  }

  return JSON.stringify(value) ?? 'undefined';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function isPlanComplete(plan: SkillCopyPlan): boolean {
  return (
    plan.create.length === 0
    && plan.link.length === 0
    && plan.overflow.length === 0
    && plan.unresolved.length === 0
    && plan.invalid.length === 0
  );
}

export function planSkillCopy(input: SkillCopyInput, now: string): SkillCopyPlan {
  const plan: SkillCopyPlan = {
    create: [],
    link: [],
    overflow: [],
    unresolved: [],
    invalid: [],
    drift: [],
    collisions: [],
  };
  const existing = new Map(input.skills.map((skill) => [skill.id, skill]));
  const available = new Set(existing.keys());
  const sources: Array<{
    id: string;
    map: () => SkillDocument;
    type: 'practice' | 'technology';
    updatedAt: string;
  }> = [
    ...input.technologies.map((tech) => ({
      id: tech.id,
      type: 'technology' as const,
      updatedAt: tech.updatedAt,
      map: () => technologyToSkill(tech, now),
    })),
    ...input.practices.map((practice) => ({
      id: practice.id,
      type: 'practice' as const,
      updatedAt: practice.updatedAt,
      map: () => practiceToSkill(practice, now),
    })),
  ];

  for (const source of sources) {
    let skill: SkillDocument;

    try {
      skill = source.map();
    } catch (error) {
      plan.invalid.push({ sourceId: source.id, message: errorMessage(error) });
      continue;
    }

    const copy = existing.get(skill.id);

    if (!copy) {
      plan.create.push({ sourceId: source.id, sourceType: source.type, skill });
      available.add(skill.id);
      continue;
    }

    const fields = COPIED_FIELDS.filter(
      (field) => canonical(copy[field]) !== canonical(skill[field]),
    );

    if (fields.length > 0) {
      plan.drift.push({
        sourceId: source.id,
        skillId: skill.id,
        fields,
        sourceUpdatedAt: source.updatedAt,
        skillUpdatedAt: copy.updatedAt,
      });
    }
  }

  const owners: Array<[SkillOwnerType, SkillOwnerRef[]]> = [
    ['project', input.projects],
    ['experience', input.experience],
  ];

  for (const [type, list] of owners) {
    for (const owner of list) {
      const have = new Set(owner.skillIds);
      const missing = [...new Set(mapTechIds(owner.techIds))].filter((id) => !have.has(id));

      if (missing.length === 0) continue;

      const unknown = missing.filter((id) => !available.has(id));

      if (unknown.length > 0) {
        plan.unresolved.push({ type, id: owner.id, skillIds: unknown });
        continue;
      }

      const cap = OWNER_SKILL_CAPS[type];

      if (owner.skillIds.length + missing.length > cap) {
        plan.overflow.push({
          type,
          id: owner.id,
          current: owner.skillIds.length,
          missing: missing.length,
          cap,
        });
        continue;
      }

      plan.link.push({
        type,
        id: owner.id,
        rev: owner.rev,
        skillIds: [...owner.skillIds, ...missing],
        added: missing,
      });
    }
  }

  plan.collisions = findCollisions(input);

  return plan;
}

function findCollisions(input: SkillCopyInput): SkillCopyPlan['collisions'] {
  type Entry = SkillCopyPlan['collisions'][number]['entries'][number];

  const groups = new Map<string, Map<string, Entry>>();
  const rootOf = new Map<string, string>();

  for (const source of [...input.technologies, ...input.practices]) {
    rootOf.set(skillIdFor(source.id), source.id);
  }

  const add = (name: string, entry: Entry): void => {
    const slug = slugify(name);

    if (!slug) return;

    const group = groups.get(slug) ?? new Map<string, Entry>();

    group.set(entry.id, entry);
    groups.set(slug, group);
  };

  for (const tech of input.technologies) {
    add(tech.name, { type: 'technology', id: tech.id, name: tech.name });
  }

  for (const practice of input.practices) {
    for (const name of [practice.label.en, practice.label.pt]) {
      add(name, { type: 'practice', id: practice.id, name: practice.label.en });
    }
  }

  for (const skill of input.skills) {
    for (const name of [skill.name.en, skill.name.pt]) {
      add(name, { type: 'skill', id: skill.id, name: skill.name.en });
    }
  }

  const collisions: SkillCopyPlan['collisions'] = [];

  for (const [key, group] of groups) {
    const entries = [...group.values()];
    // A source and its own copy are one thing, not a collision.
    const roots = new Set(entries.map((entry) => rootOf.get(entry.id) ?? entry.id));

    if (roots.size > 1) collisions.push({ key, entries });
  }

  return collisions;
}
