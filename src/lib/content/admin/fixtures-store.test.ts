import { createFixtureDataset } from '../fixtures/dataset';
import { L, meta } from '../fixtures/helpers';
import { documentSchemas } from '../schema';
import { createFixturesAdminStore } from './fixtures-store';

describe('fixtures admin store', () => {
  it('stores skills like any other collection', async () => {
    const store = createFixturesAdminStore(createFixtureDataset(), {
      readOnlyReason: 'test',
      writable: true,
    });
    const skill = documentSchemas.skill.parse({
      ...meta('skill', 'store-round-trip'),
      order: 10,
      name: L('Testing', 'Testes'),
      categories: ['engineering'],
    });

    await expect(store.write('skill', skill, { isNew: true })).resolves.toMatchObject({ ok: true });
    expect((await store.list('skill')).map((doc) => doc.id)).toContain(skill.id);
    await expect(store.get('skill', skill.id)).resolves.toMatchObject({
      categories: ['engineering'],
    });
    await expect(store.remove('skill', skill.id)).resolves.toMatchObject({ ok: true });
    expect((await store.list('skill')).map((doc) => doc.id)).not.toContain(skill.id);
  });

  it('keeps project skill ids on read-back', async () => {
    const dataset = createFixtureDataset();
    const store = createFixturesAdminStore(dataset, { readOnlyReason: 'test', writable: true });
    const project = dataset.project[0];

    if (!project) throw new Error('Expected a fixture project');

    const skillIds = (project.skillIds ?? []).slice(0, 2);

    await store.patch('project', project.id, { skillIds });

    await expect(store.get('project', project.id)).resolves.toMatchObject({ skillIds });
  });

  it('keeps experience skill ids on read-back', async () => {
    const dataset = createFixtureDataset();
    const store = createFixturesAdminStore(dataset, { readOnlyReason: 'test', writable: true });
    const job = dataset.experience[0];

    if (!job) throw new Error('Expected a fixture experience');

    const skillIds = (job.skillIds ?? []).slice(0, 2);

    expect(skillIds).toHaveLength(2);

    await store.patch('experience', job.id, { skillIds });

    await expect(store.get('experience', job.id)).resolves.toMatchObject({ skillIds });
  });

  it('keeps education skill ids on read-back', async () => {
    const dataset = createFixtureDataset();
    const store = createFixturesAdminStore(dataset, { readOnlyReason: 'test', writable: true });
    const degree = dataset.education[0];

    if (!degree) throw new Error('Expected a fixture education');

    const skillIds = (degree.skillIds ?? []).slice(0, 2);

    expect(skillIds).toHaveLength(2);

    await store.patch('education', degree.id, { skillIds });

    await expect(store.get('education', degree.id)).resolves.toMatchObject({ skillIds });
  });

  it('lists documents by order, like the Sanity admin query', async () => {
    const store = createFixturesAdminStore(createFixtureDataset(), {
      readOnlyReason: 'test',
      writable: true,
    });
    const [first, second] = (await store.list('practice')).map((doc) => doc.id);

    if (!first || !second) throw new Error('Expected at least two practices');

    await store.patch('practice', first, { order: 999_990 });
    await store.patch('practice', second, { order: 999_980 });

    const ids = (await store.list('practice')).map((doc) => doc.id);

    expect(ids.slice(-2)).toEqual([second, first]);
  });
});

describe('fixtures admin store setSkillLinks', () => {
  const open = (): ReturnType<typeof createFixturesAdminStore> =>
    createFixturesAdminStore(createFixtureDataset(), { readOnlyReason: 'test', writable: true });

  it('applies several changes and bumps each revision', async () => {
    const store = open();
    const [project] = await store.list('project');
    const [education] = await store.list('education');
    const result = await store.setSkillLinks([
      { type: 'project', id: project!.id, skillIds: [], expectedRev: project!.rev! },
      { type: 'education', id: education!.id, skillIds: ['a'], expectedRev: education!.rev! },
    ]);
    const after = (await store.list('project')).find((doc) => doc.id === project!.id)!;
    const afterEducation = (await store.list('education')).find((doc) => doc.id === education!.id)!;

    expect(result.ok).toBe(true);
    expect(after['skillIds']).toEqual([]);
    expect(after.rev).not.toBe(project!.rev);
    expect(afterEducation['skillIds']).toEqual(['a']);
    expect(afterEducation.rev).not.toBe(education!.rev);
  });

  it('applies nothing when one revision is stale', async () => {
    const store = open();
    const [project] = await store.list('project');
    const [education] = await store.list('education');
    const result = await store.setSkillLinks([
      { type: 'project', id: project!.id, skillIds: [], expectedRev: project!.rev! },
      { type: 'education', id: education!.id, skillIds: [], expectedRev: 'stale' },
    ]);
    const after = (await store.list('project')).find((doc) => doc.id === project!.id)!;

    expect(result).toEqual({ ok: false, reason: 'conflict' });
    expect(after['skillIds']).toEqual(project!['skillIds']);
    expect(after.rev).toBe(project!.rev);
  });

  it('reports a missing document', async () => {
    const result = await open().setSkillLinks([
      { type: 'project', id: 'nope', skillIds: [], expectedRev: 'x' },
    ]);

    expect(result).toEqual({ ok: false, reason: 'missing' });
  });
});
