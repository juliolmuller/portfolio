import { practiceToSkill, skillIdFor, technologyToSkill } from '../../migrations/skills';
import { documentSchemas, type SkillInput } from '../../schema';
import { FIXTURE_UPDATED_AT } from '../helpers';
import { fixtureId, techId } from '../ids';
import { practices } from './practices';
import { technologies } from './technologies';

/**
 * Skill copies of every technology and practice, built with the shared mapper
 * (D93, #58) so fixtures, the seed and the production migration agree on ids
 * and content. The dependency on technologies.ts and practices.ts goes away in
 * #89.
 */
export const skills: SkillInput[] = [
  ...technologies.map((technology) => ({
    ...technologyToSkill(documentSchemas.technology.parse(technology), FIXTURE_UPDATED_AT),
    rev: 'fixture',
  })),
  ...practices.map((practice) => ({
    ...practiceToSkill(documentSchemas.practice.parse(practice), FIXTURE_UPDATED_AT),
    rev: 'fixture',
  })),
];

const technologyNames = new Set(technologies.map((technology) => technology.name));

/**
 * Id of the skill copy of a fixture technology, for fixture references. Throws
 * on an unknown name so a typo fails at load time instead of dangling.
 */
export function skillRef(name: string): string {
  if (!technologyNames.has(name)) throw new Error(`Unknown fixture technology "${name}"`);

  return skillIdFor(techId(name));
}

const practiceLabels = new Set(practices.map((practice) => practice.label.en));

/**
 * Id of the skill copy of a fixture practice, by its English label. Throws on
 * an unknown label so a typo fails at load time instead of dangling.
 */
export function practiceSkillRef(label: string): string {
  if (!practiceLabels.has(label)) throw new Error(`Unknown fixture practice "${label}"`);

  return skillIdFor(fixtureId('practice', label));
}
