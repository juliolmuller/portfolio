import { createFixtureDataset } from '../fixtures/dataset';
import { L, meta } from '../fixtures/helpers';
import { documentSchemas, experienceSchema, projectSchema } from '../schema';
import {
  isPlanComplete,
  OWNER_SKILL_CAPS,
  planSkillCopy,
  type SkillCopyInput,
  type SkillCopyPlan,
  type SkillOwnerRef,
} from './plan';
import { mapTechIds, PRACTICE_ORDER_OFFSET, skillIdFor } from './skills';

const NOW = '2026-11-17T12:00:00Z';

function preCopyInput(): SkillCopyInput {
  const dataset = createFixtureDataset();
  const owner = (doc: { id: string; techIds: string[] }): SkillOwnerRef => ({
    id: doc.id,
    rev: 'r1',
    techIds: [...doc.techIds],
    skillIds: [],
  });

  return {
    technologies: dataset.technology.map((doc) => documentSchemas.technology.parse(doc)),
    practices: dataset.practice.map((doc) => documentSchemas.practice.parse(doc)),
    skills: [],
    projects: dataset.project.map((doc) => owner(documentSchemas.project.parse(doc))),
    experience: dataset.experience.map((doc) => owner(documentSchemas.experience.parse(doc))),
  };
}

/**
 * What a successful `--apply` leaves behind.
 */
function applyPlan(input: SkillCopyInput, plan: SkillCopyPlan): SkillCopyInput {
  const links = new Map(plan.link.map((item) => [item.id, item.skillIds]));
  const relink = (owner: SkillOwnerRef): SkillOwnerRef => ({
    ...owner,
    skillIds: links.get(owner.id) ?? owner.skillIds,
  });

  return {
    ...input,
    skills: [...input.skills, ...plan.create.map((item) => item.skill)],
    projects: input.projects.map(relink),
    experience: input.experience.map(relink),
  };
}

describe('planSkillCopy', () => {
  it('plans every copy and every link for an unmigrated dataset', () => {
    const input = preCopyInput();
    const plan = planSkillCopy(input, NOW);

    expect(plan.create).toHaveLength(input.technologies.length + input.practices.length);
    expect(plan.create).toHaveLength(112);
    expect(plan.create.map((item) => item.skill.id)).toEqual(
      [...input.technologies, ...input.practices].map((doc) => skillIdFor(doc.id)),
    );
    expect(plan.link.filter((item) => item.type === 'project')).toHaveLength(7);
    expect(plan.link.filter((item) => item.type === 'experience')).toHaveLength(3);

    const hidden = createFixtureDataset().project.filter((doc) => doc.visible === false);

    expect(hidden.length).toBeGreaterThan(0);

    for (const doc of hidden) expect(plan.link.some((item) => item.id === doc.id)).toBe(true);

    for (const item of plan.link) {
      const owner = [...input.projects, ...input.experience].find((entry) => entry.id === item.id)!;

      expect(item.skillIds).toEqual(mapTechIds(owner.techIds));
      expect(item.rev).toBe('r1');
    }

    expect(plan.overflow).toEqual([]);
    expect(plan.unresolved).toEqual([]);
    expect(plan.invalid).toEqual([]);
    expect(isPlanComplete(plan)).toBe(false);
  });

  it('is complete on the second run', () => {
    const input = preCopyInput();
    const first = planSkillCopy(input, NOW);
    const second = planSkillCopy(applyPlan(input, first), NOW);

    expect(isPlanComplete(second)).toBe(true);
    expect(second.create).toEqual([]);
    expect(second.link).toEqual([]);
    expect(second.drift).toEqual([]);
    expect(second.collisions).toEqual(first.collisions);
  });

  it('never changes sources or its input', () => {
    const input = preCopyInput();
    const before = JSON.stringify(input);
    const sources = JSON.stringify([input.technologies, input.practices]);
    const plan = planSkillCopy(input, NOW);

    expect(JSON.stringify(input)).toBe(before);

    applyPlan(input, plan);

    expect(JSON.stringify([input.technologies, input.practices])).toBe(sources);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('keeps existing links first and only appends', () => {
    const input = preCopyInput();
    const base = planSkillCopy(input, NOW);
    const extra = documentSchemas.skill.parse({
      ...meta('skill', 'Unrelated'),
      name: L('Unrelated thing', 'Coisa sem relação'),
      categories: ['engineering'],
      order: 1,
    });
    const project = input.projects[0]!;

    project.skillIds = [extra.id];

    const plan = planSkillCopy({ ...input, skills: [extra] }, NOW);
    const link = plan.link.find((item) => item.id === project.id)!;

    expect(link.skillIds).toEqual([extra.id, ...mapTechIds(project.techIds)]);
    expect(link.added).toEqual(mapTechIds(project.techIds));
    expect(base.create).toEqual(plan.create);
  });

  it('reports drift without planning a write for the edited copy', () => {
    const input = preCopyInput();
    const complete = applyPlan(input, planSkillCopy(input, NOW));
    const copy = complete.skills[0]!;

    copy.name = { ...copy.name, pt: 'Editado' };
    copy.categories = [...copy.categories, 'engineering'];

    const plan = planSkillCopy(complete, NOW);

    expect(plan.drift).toHaveLength(1);
    expect(plan.drift[0]).toMatchObject({ skillId: copy.id, fields: ['name', 'categories'] });
    expect(plan.create).toEqual([]);
    expect(plan.link).toEqual([]);
    expect(isPlanComplete(plan)).toBe(true);
  });

  it('reports a collision and still creates the copy', () => {
    const input = preCopyInput();
    const tech = input.technologies[0]!;
    const handMade = documentSchemas.skill.parse({
      ...meta('skill', 'Hand made'),
      name: L(tech.name, tech.name),
      categories: ['engineering'],
      order: 1,
    });
    const plan = planSkillCopy({ ...input, skills: [handMade] }, NOW);
    const collision = plan.collisions.find((item) =>
      item.entries.some((entry) => entry.id === handMade.id),
    );

    expect(collision?.entries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([tech.id, handMade.id]),
    );
    expect(plan.create.some((item) => item.sourceId === tech.id)).toBe(true);
  });

  it('does not report a source and its own copy as a collision', () => {
    const input = preCopyInput();
    const complete = applyPlan(input, planSkillCopy(input, NOW));

    expect(planSkillCopy(complete, NOW).collisions).toEqual(planSkillCopy(input, NOW).collisions);
  });

  it('reports an owner over the limit and links nothing', () => {
    const input = preCopyInput();
    const fillers = (count: number): string[] =>
      Array.from({ length: count }, (_, index) => `skill.filler-${index}`);
    const project = input.projects.find((item) => item.techIds.length >= 5)!;
    const experience = input.experience[0]!;

    project.techIds = project.techIds.slice(0, 5);
    project.skillIds = fillers(30);
    experience.techIds = experience.techIds.slice(0, 5);
    experience.skillIds = fillers(44);

    const plan = planSkillCopy(input, NOW);

    expect(plan.overflow).toEqual([
      { type: 'project', id: project.id, current: 30, missing: 5, cap: 32 },
      { type: 'experience', id: experience.id, current: 44, missing: 5, cap: 48 },
    ]);
    expect(plan.link.some((item) => item.id === project.id || item.id === experience.id)).toBe(
      false,
    );
    expect(isPlanComplete(plan)).toBe(false);
  });

  it('reports an owner whose skill cannot exist', () => {
    const input = preCopyInput();
    const project = input.projects[0]!;

    project.techIds = [...project.techIds, 'technology.gone'];

    const plan = planSkillCopy(input, NOW);

    expect(plan.unresolved).toEqual([
      { type: 'project', id: project.id, skillIds: [skillIdFor('technology.gone')] },
    ]);
    expect(plan.link.some((item) => item.id === project.id)).toBe(false);
  });

  it('reports a source that cannot be copied', () => {
    const input = preCopyInput();
    const tech = input.technologies[0]!;

    tech.order = PRACTICE_ORDER_OFFSET;

    const plan = planSkillCopy(input, NOW);

    expect(plan.invalid.map((item) => item.sourceId)).toEqual([tech.id]);
    expect(plan.create.some((item) => item.sourceId === tech.id)).toBe(false);
  });

  it('uses the same limits as the schemas', () => {
    const ids = (count: number): string[] =>
      Array.from({ length: count }, (_, index) => `skill.id-${index}`);
    const project = createFixtureDataset().project[0]!;
    const experience = createFixtureDataset().experience[0]!;
    const projectOk = (count: number): boolean =>
      projectSchema.safeParse({ ...project, skillIds: ids(count) }).success;
    const experienceOk = (count: number): boolean =>
      experienceSchema.safeParse({ ...experience, skillIds: ids(count) }).success;

    expect(projectOk(OWNER_SKILL_CAPS.project)).toBe(true);
    expect(projectOk(OWNER_SKILL_CAPS.project + 1)).toBe(false);
    expect(experienceOk(OWNER_SKILL_CAPS.experience)).toBe(true);
    expect(experienceOk(OWNER_SKILL_CAPS.experience + 1)).toBe(false);
  });
});
