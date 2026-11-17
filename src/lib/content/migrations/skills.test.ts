import { createFixtureDataset } from '../fixtures/dataset';
import { techId } from '../fixtures/ids';
import { documentSchemas, skillSchema } from '../schema';
import {
  mapTechIds,
  PRACTICE_ORDER_OFFSET,
  practiceToSkill,
  skillIdFor,
  technologyToSkill,
} from './skills';

const NOW = '2026-11-17T12:00:00Z';
const TYPESCRIPT_SKILL_ID = 'skill.99609fbb-7be5-5f16-8d36-abe063d9df76';

const dataset = createFixtureDataset();
const technologies = dataset.technology.map((doc) => documentSchemas.technology.parse(doc));
const practices = dataset.practice.map((doc) => documentSchemas.practice.parse(doc));
const typescript = technologies.find((tech) => tech.name === 'TypeScript')!;
const practice = practices[0]!;

describe('skill copy mapper', () => {
  it('maps every technology and practice to a valid skill', () => {
    const skills = [
      ...technologies.map((tech) => ({ source: tech.id, skill: technologyToSkill(tech, NOW) })),
      ...practices.map((item) => ({ source: item.id, skill: practiceToSkill(item, NOW) })),
    ];

    for (const { source, skill } of skills) {
      const result = skillSchema.safeParse(skill);

      expect(result.success, `${source}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      expect(skillSchema.parse(skill)).toStrictEqual(skill);
    }
  });

  it('derives unique ids that differ from the source ids', () => {
    const sources = [...technologies, ...practices].map((doc) => doc.id);
    const ids = sources.map(skillIdFor);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => sources.includes(id))).toEqual([]);
  });

  it('is deterministic', () => {
    const run = (): unknown => ({
      techs: technologies.map((tech) => technologyToSkill(tech, NOW)),
      practices: practices.map((item) => practiceToSkill(item, NOW)),
    });

    expect(run()).toStrictEqual(run());
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    expect(skillIdFor(typescript.id)).toBe(TYPESCRIPT_SKILL_ID);
  });

  it('maps a technology', () => {
    const skill = technologyToSkill(typescript, NOW);

    expect(skill).toMatchObject({
      name: { en: 'TypeScript', pt: 'TypeScript' },
      categories: ['language'],
      iconSource: typescript.iconSource,
      iconSlug: typescript.iconSlug,
      showInCloud: true,
      priority: typescript.priority,
      order: typescript.order,
      url: typescript.url,
      updatedAt: NOW,
    });
    expect('rev' in skill).toBe(false);
  });

  it('copies the brand color only when present', () => {
    const withColor = technologies.find((tech) => tech.brandColor !== undefined)!;

    expect(technologyToSkill(withColor, NOW).brandColor).toBe(withColor.brandColor);

    const without = technologies.find((tech) => tech.brandColor === undefined)!;

    expect('brandColor' in technologyToSkill(without, NOW)).toBe(false);
  });

  it('copies a monogram override and adds none when the source has none', () => {
    const withText = technologies.find(
      (tech) => tech.iconSource === 'monogram' && tech.monogram !== undefined,
    )!;
    const withoutText = technologies.find(
      (tech) => tech.iconSource === 'monogram' && tech.monogram === undefined,
    )!;

    expect(technologyToSkill(withText, NOW)).toMatchObject({
      iconSource: 'monogram',
      monogram: withText.monogram,
    });
    expect(technologyToSkill(withoutText, NOW).iconSource).toBe('monogram');
    expect('monogram' in technologyToSkill(withoutText, NOW)).toBe(false);
  });

  it('clones a custom svg', () => {
    const tech = documentSchemas.technology.parse({
      ...dataset.technology[0],
      iconSource: 'custom-svg',
      iconSlug: undefined,
      customSvg: { viewBox: '0 0 24 24', paths: ['M0 0L24 24'] },
    });
    const skill = technologyToSkill(tech, NOW);

    expect(skillSchema.safeParse(skill).success).toBe(true);
    expect(skill.customSvg).toStrictEqual(tech.customSvg);
    expect(skill.customSvg).not.toBe(tech.customSvg);
  });

  it('maps a practice', () => {
    const skill = practiceToSkill(practice, NOW);

    expect(skill.categories).toEqual(['engineering']);

    for (const key of ['iconSource', 'iconSlug', 'customSvg', 'monogram', 'rev']) {
      expect(key in skill).toBe(false);
    }

    expect(skill.showInCloud).toBe(false);
    expect(skill.priority).toBe(2);
    expect(skill.order).toBe(PRACTICE_ORDER_OFFSET + practice.order);
    expect(skill.name).toStrictEqual({ en: practice.label.en, pt: practice.label.pt });
    expect(skill.updatedAt).toBe(NOW);
  });

  it('sorts practices after technologies', () => {
    const maxTech = Math.max(...technologies.map((tech) => technologyToSkill(tech, NOW).order));
    const minPractice = Math.min(...practices.map((item) => practiceToSkill(item, NOW).order));

    expect(minPractice).toBeGreaterThan(maxTech);
  });

  it('rejects a technology order that would not sort before the practices', () => {
    const last = PRACTICE_ORDER_OFFSET - 1;

    expect(technologyToSkill({ ...typescript, order: last }, NOW).order).toBe(last);
    expect(() => technologyToSkill({ ...typescript, order: PRACTICE_ORDER_OFFSET }, NOW)).toThrow(
      RangeError,
    );
  });

  it('rejects a practice order that would pass the schema cap', () => {
    const cap = 1_000_000;
    const last = cap - PRACTICE_ORDER_OFFSET;

    expect(practiceToSkill({ ...practice, order: last }, NOW).order).toBe(cap);
    expect(() => practiceToSkill({ ...practice, order: last + 1 }, NOW)).toThrow(
      `${practice.id} cannot be copied to a skill (order: `,
    );
  });

  it('rejects a timestamp the schema would reject, naming the source', () => {
    expect(() => technologyToSkill(typescript, 'yesterday')).toThrow(
      `${typescript.id} cannot be copied to a skill (updatedAt: `,
    );
    expect(() => practiceToSkill(practice, 'yesterday')).toThrow(
      `${practice.id} cannot be copied to a skill (updatedAt: `,
    );
  });

  it('keeps hidden items hidden and carries isFixture', () => {
    expect(technologyToSkill({ ...typescript, visible: false }, NOW).visible).toBe(false);
    expect(practiceToSkill({ ...practice, visible: false }, NOW).visible).toBe(false);
    expect(technologyToSkill({ ...typescript, isFixture: true }, NOW).isFixture).toBe(true);

    const { isFixture: _omit, ...bare } = typescript;

    expect('isFixture' in technologyToSkill(bare, NOW)).toBe(false);
    expect('isFixture' in practiceToSkill({ ...practice, isFixture: undefined }, NOW)).toBe(false);
  });

  it('does not mutate sources or share references', () => {
    const techCopy = structuredClone(typescript);
    const practiceCopy = structuredClone(practice);
    const techSkill = technologyToSkill(typescript, NOW);
    const practiceSkill = practiceToSkill(practice, NOW);

    techSkill.categories.push('data');
    practiceSkill.name.en = 'changed';

    expect(typescript).toStrictEqual(techCopy);
    expect(practice).toStrictEqual(practiceCopy);
  });

  it('maps technology ids in order', () => {
    const ids = [techId('TypeScript'), techId('React')];
    const copy = [...ids];

    expect(mapTechIds(ids)).toEqual(ids.map(skillIdFor));
    expect(ids).toEqual(copy);
    expect(mapTechIds([])).toEqual([]);
  });
});
