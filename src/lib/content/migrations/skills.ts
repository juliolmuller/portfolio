import { derivedId } from '../ids';
import { type PracticeDocument, type SkillDocument, type TechnologyDocument } from '../schema';

/**
 * Pure copy mapping for epic #54 (D93); used by fixtures (#59), skills:migrate
 * (#65) and the dashboard check (#68). No I/O.
 */

/**
 * Practices sort after every technology once copied.
 */
export const PRACTICE_ORDER_OFFSET = 100_000;

/**
 * Source ids carry their type prefix, so copies of technologies and copies of
 * practices never collide.
 */
export function skillIdFor(sourceId: string): string {
  return derivedId('skill', sourceId);
}

export function technologyToSkill(tech: TechnologyDocument, now: string): SkillDocument {
  return {
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
  };
}

export function practiceToSkill(practice: PracticeDocument, now: string): SkillDocument {
  return {
    id: skillIdFor(practice.id),
    updatedAt: now,
    ...(practice.isFixture !== undefined ? { isFixture: practice.isFixture } : {}),
    name: { en: practice.label.en, pt: practice.label.pt },
    categories: ['engineering'],
    showInCloud: false,
    priority: 2,
    order: PRACTICE_ORDER_OFFSET + practice.order,
    visible: practice.visible,
  };
}

export function mapTechIds(techIds: readonly string[]): string[] {
  return techIds.map(skillIdFor);
}
