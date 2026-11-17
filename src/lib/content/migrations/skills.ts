import { derivedId } from '../ids';
import {
  type PracticeDocument,
  type SkillDocument,
  skillSchema,
  type TechnologyDocument,
} from '../schema';

/**
 * Pure copy mapping for epic #54 (D93); used by fixtures (#59), skills:migrate
 * (#65) and the dashboard check (#68). No I/O. Each mapper checks its result
 * against `skillSchema` and throws, naming the source id, instead of returning
 * a skill that a later write or read would reject.
 */

/**
 * Practices sort after every technology once copied. That holds only while
 * technology orders stay below this offset, so `technologyToSkill` rejects
 * larger ones; a practice order that would pass the schema cap after the offset
 * is rejected by the schema check.
 */
export const PRACTICE_ORDER_OFFSET = 100_000;

/**
 * Document ids are unique across a dataset, so distinct sources always get
 * distinct copies. Nothing here parses or relies on the shape of a source id.
 */
export function skillIdFor(sourceId: string): string {
  return derivedId('skill', sourceId);
}

function validated(sourceId: string, skill: SkillDocument): SkillDocument {
  const result = skillSchema.safeParse(skill);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

    throw new Error(`${sourceId} cannot be copied to a skill (${issues.join('; ')})`);
  }

  return skill;
}

export function technologyToSkill(tech: TechnologyDocument, now: string): SkillDocument {
  if (tech.order >= PRACTICE_ORDER_OFFSET) {
    throw new RangeError(
      `${tech.id} has order ${tech.order}; it must stay below ${PRACTICE_ORDER_OFFSET} so practices sort after technologies`,
    );
  }

  return validated(tech.id, {
    id: skillIdFor(tech.id),
    updatedAt: now,
    ...(tech.isFixture !== undefined ? { isFixture: tech.isFixture } : {}),
    name: { en: tech.name, pt: tech.name },
    categories: [tech.category],
    iconSource: tech.iconSource,
    ...(tech.iconSlug !== undefined ? { iconSlug: tech.iconSlug } : {}),
    ...(tech.customSvg !== undefined ? { customSvg: structuredClone(tech.customSvg) } : {}),
    ...(tech.monogram !== undefined ? { monogram: tech.monogram } : {}),
    showInCloud: true,
    ...(tech.brandColor !== undefined ? { brandColor: tech.brandColor } : {}),
    ...(tech.url !== undefined ? { url: tech.url } : {}),
    priority: tech.priority,
    order: tech.order,
    visible: tech.visible,
  });
}

export function practiceToSkill(practice: PracticeDocument, now: string): SkillDocument {
  return validated(practice.id, {
    id: skillIdFor(practice.id),
    updatedAt: now,
    ...(practice.isFixture !== undefined ? { isFixture: practice.isFixture } : {}),
    name: { en: practice.label.en, pt: practice.label.pt },
    categories: ['engineering'],
    showInCloud: false,
    priority: 2,
    order: PRACTICE_ORDER_OFFSET + practice.order,
    visible: practice.visible,
  });
}

export function mapTechIds(techIds: readonly string[]): string[] {
  return techIds.map(skillIdFor);
}
