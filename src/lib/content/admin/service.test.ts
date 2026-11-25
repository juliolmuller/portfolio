import { describe, expect, it } from 'vitest';

import { createFixtureDataset } from '../fixtures/dataset';
import { createFixturesAdminStore } from './fixtures-store';
import { createAdminService } from './service';
import { type AdminDoc } from './types';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred type is the clearest description
function setup(writable = true) {
  const dataset = createFixtureDataset();
  const store = createFixturesAdminStore(dataset, {
    writable,
    readOnlyReason: 'read-only',
  });
  const revalidated: string[] = [];
  const audits: string[] = [];
  const service = createAdminService(store, {
    revalidate: (type, slugs) => revalidated.push(`${type}:${slugs.join(',')}`),
    audit: (event) => audits.push(`${event.type}:${event.action}`),
    now: () => new Date('2026-10-27T12:00:00Z'),
  });

  return { store, service, revalidated, audits };
}

async function firstProject(store: ReturnType<typeof setup>['store']): Promise<AdminDoc> {
  const [project] = (await store.list('project')).filter((doc) => doc['visible'] !== false);

  return (await store.get('project', project!.id))!;
}

describe('save', () => {
  it('keeps experience skill ids on save', async () => {
    const { store, service } = setup();
    const [first] = await store.list('experience');
    const doc = (await store.get('experience', first!.id))!;
    const result = await service.save(
      'experience',
      doc.id,
      { ...doc, collapsedByDefault: !doc['collapsedByDefault'] },
      doc.rev,
    );
    const after = (await store.get('experience', doc.id))!;

    expect(result.ok).toBe(true);
    expect((doc['skillIds'] as string[]).length).toBeGreaterThan(0);
    expect(after['skillIds']).toEqual(doc['skillIds']);
  });

  it('keeps project tech ids when skill ids change', async () => {
    const { store, service } = setup();
    const docs = await Promise.all(
      (await store.list('project')).map(async (item) => (await store.get('project', item.id))!),
    );
    const doc = docs.find(
      (entry) => ((entry['techIds'] as string[] | undefined) ?? []).length > 0,
    )!;
    const skillIds = (doc['skillIds'] as string[]).slice(0, 2);
    const result = await service.save('project', doc.id, { ...doc, skillIds }, doc.rev);
    const after = (await store.get('project', doc.id))!;

    expect(result.ok).toBe(true);
    expect((doc['techIds'] as string[]).length).toBeGreaterThan(0);
    expect(after['techIds']).toEqual(doc['techIds']);
    expect(after['skillIds']).toEqual(skillIds);
  });

  it('keeps education skill ids on save', async () => {
    const { store, service } = setup();
    const docs = await Promise.all(
      (await store.list('education')).map(async (item) => (await store.get('education', item.id))!),
    );
    const doc = docs.find(
      (entry) => ((entry['skillIds'] as string[] | undefined) ?? []).length > 0,
    )!;
    const result = await service.save(
      'education',
      doc.id,
      { ...doc, visible: !doc['visible'] },
      doc.rev,
    );
    const after = (await store.get('education', doc.id))!;

    expect(result.ok).toBe(true);
    expect((doc['skillIds'] as string[]).length).toBeGreaterThan(0);
    expect(after['skillIds']).toEqual(doc['skillIds']);
  });

  it('updates a singleton, bumps the revision and revalidates', async () => {
    const { store, service, revalidated, audits } = setup();
    const before = (await store.get('profile', 'profile'))!;
    const result = await service.save(
      'profile',
      null,
      { ...before, displayName: 'Julio Edited' },
      before.rev,
    );

    expect(result).toMatchObject({ ok: true, id: 'profile' });

    const after = (await store.get('profile', 'profile'))!;

    expect(after['displayName']).toBe('Julio Edited');
    expect(after.rev).not.toBe(before.rev);
    expect(after.updatedAt).toBe('2026-10-27T12:00:00.000Z');
    expect(revalidated).toEqual(['profile:']);
    expect(audits).toEqual(['profile:update']);
  });

  it('reports field errors by path and writes nothing', async () => {
    const { store, service, revalidated } = setup();
    const before = (await store.get('profile', 'profile'))!;
    const result = await service.save('profile', null, {
      ...before,
      jobTitle: { en: 'Engineer', pt: '' },
      displayName: '',
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'invalid',
      fieldErrors: { 'jobTitle.pt': 'Required', 'displayName': 'Required' },
    });
    expect((await store.get('profile', 'profile'))!.rev).toBe(before.rev);
    expect(revalidated).toEqual([]);
  });

  it('detects a stale revision', async () => {
    const { store, service } = setup();
    const before = (await store.get('profile', 'profile'))!;

    await service.save('profile', null, before, before.rev);

    const stale = await service.save(
      'profile',
      null,
      { ...before, displayName: 'Late' },
      before.rev,
    );

    expect(stale).toEqual({ ok: false, kind: 'conflict' });
  });

  it('refuses every write when the store is read-only', async () => {
    const { store, service } = setup(false);
    const before = (await store.get('profile', 'profile'))!;

    expect(await service.save('profile', null, before)).toEqual({
      ok: false,
      kind: 'readonly',
    });
    expect(await service.remove('project', 'x')).toEqual({
      ok: false,
      kind: 'readonly',
    });
  });

  it('creates a project with an appended order and a fresh id', async () => {
    const { store, service } = setup();
    const template = await firstProject(store);
    const { id, rev, order, slug, ...rest } = template;
    const before = (await store.list('project')).length;
    const result = await service.save('project', null, {
      ...rest,
      slug: 'brand-new',
      title: { en: 'Brand new', pt: 'Novinho' },
    });

    expect(result).toMatchObject({ ok: true, slug: 'brand-new' });

    const projects = await store.list('project');

    expect(projects).toHaveLength(before + 1);

    const created = projects.find((doc) => doc['slug'] === 'brand-new')!;

    expect(created.id).toMatch(/^project\./);
    expect(created['order']).toBe(
      Math.max(...projects.filter((p) => p !== created).map((p) => Number(p['order']))) + 10,
    );
  });

  it('never stores a skill without an icon in the cloud', async () => {
    const { store, service } = setup();
    const result = await service.save('skill', null, {
      name: { en: 'Plain skill', pt: 'Habilidade simples' },
      categories: ['frontend'],
      showInCloud: true,
      iconSlug: 'react',
      visible: true,
    });

    expect(result.ok).toBe(true);

    const stored = (await store.list('skill')).find(
      (d) => (d['name'] as { en: string }).en === 'Plain skill',
    )!;

    expect(stored['showInCloud']).toBe(false);
    expect(stored['iconSlug']).toBeUndefined();
  });

  it('keeps showInCloud on a skill with an icon', async () => {
    const { store, service } = setup();
    const result = await service.save('skill', null, {
      name: { en: 'Iconic skill', pt: 'Habilidade com ícone' },
      categories: ['frontend'],
      iconSource: 'monogram',
      showInCloud: true,
      visible: true,
    });

    expect(result.ok).toBe(true);

    const stored = (await store.list('skill')).find(
      (d) => (d['name'] as { en: string }).en === 'Iconic skill',
    )!;

    expect(stored['showInCloud']).toBe(true);
  });

  it('drops the icon and the cloud flag when a skill is saved again without an icon', async () => {
    const { store, service } = setup();
    const created = await service.save('skill', null, {
      name: { en: 'Fading skill', pt: 'Habilidade que perde o icone' },
      categories: ['frontend'],
      iconSource: 'simple-icons',
      iconSlug: 'react',
      showInCloud: true,
      visible: true,
    });

    expect(created).toMatchObject({ ok: true });

    const id = created.ok ? created.id : '';
    const before = (await store.get('skill', id))!;

    expect(before['iconSlug']).toBe('react');
    expect(before['showInCloud']).toBe(true);

    const result = await service.save(
      'skill',
      id,
      {
        name: { en: 'Fading skill', pt: 'Habilidade que perde o icone' },
        categories: ['frontend'],
        showInCloud: true,
        visible: true,
      },
      before.rev,
    );

    expect(result).toMatchObject({ ok: true });

    const after = (await store.get('skill', id))!;

    expect(after['iconSource']).toBeUndefined();
    expect(after['iconSlug']).toBeUndefined();
    expect(after['showInCloud']).toBe(false);
  });

  it('rejects a custom-SVG skill without an SVG', async () => {
    const { service } = setup();
    const result = await service.save('skill', null, {
      name: { en: 'Broken svg', pt: 'SVG quebrado' },
      categories: ['frontend'],
      iconSource: 'custom-svg',
      visible: true,
    });

    expect(result).toMatchObject({ ok: false, kind: 'invalid' });
    expect(result.ok === false && 'fieldErrors' in result && result.fieldErrors).toHaveProperty(
      'customSvg',
    );
  });

  it('rejects a duplicate slug, including another project’s old slug', async () => {
    const { store, service } = setup();
    const projects = await store.list('project');
    const a = (await store.get('project', projects[0]!.id))!;
    const b = projects[1]!;
    const taken = await service.save('project', a.id, { ...a, slug: b['slug'] }, a.rev);

    expect(taken).toMatchObject({
      ok: false,
      fieldErrors: { slug: expect.stringContaining('already') },
    });
  });

  it('keeps the old slug as a previous slug when it changes', async () => {
    const { store, service, revalidated } = setup();
    const project = await firstProject(store);
    const oldSlug = project['slug'] as string;
    const result = await service.save(
      'project',
      project.id,
      { ...project, slug: 'renamed-slug' },
      project.rev,
    );

    expect(result).toMatchObject({ ok: true });

    const after = (await store.get('project', project.id))!;

    expect(after['slug']).toBe('renamed-slug');
    expect(after['previousSlugs']).toContain(oldSlug);
    expect(revalidated.at(-1)).toBe(`project:renamed-slug,${oldSlug}`);

    const back = await service.save('project', project.id, { ...after, slug: oldSlug }, after.rev);

    expect(back).toMatchObject({ ok: true });

    const restored = (await store.get('project', project.id))!;

    expect(restored['previousSlugs']).toEqual(expect.not.arrayContaining([oldSlug]));
  });

  it('rejects unknown technologies and raw HTML', async () => {
    const { store, service } = setup();
    const project = await firstProject(store);
    const bad = await service.save(
      'project',
      project.id,
      {
        ...project,
        techIds: ['technology.nope'],
        body: { en: '<script>x</script>', pt: 'ok' },
      },
      project.rev,
    );

    expect(bad).toMatchObject({
      ok: false,
      fieldErrors: { 'body.en': 'Raw HTML is not allowed' },
    });

    const unknown = await service.save(
      'project',
      project.id,
      { ...project, techIds: ['technology.nope'] },
      project.rev,
    );

    expect(unknown).toMatchObject({
      ok: false,
      fieldErrors: { 'techIds.0': 'Unknown technology' },
    });
  });

  it('rejects project skills that do not exist', async () => {
    const { store, service } = setup();
    const project = await firstProject(store);
    const unknown = await service.save(
      'project',
      project.id,
      { ...project, skillIds: [...(project['skillIds'] as string[]), 'skill.nope'] },
      project.rev,
    );
    const count = (project['skillIds'] as string[]).length;

    expect(unknown).toMatchObject({
      ok: false,
      fieldErrors: { [`skillIds.${count}`]: 'Unknown skill' },
    });
  });

  it('rejects experience skills that do not exist', async () => {
    const { store, service } = setup();
    const [first] = await store.list('experience');
    const job = (await store.get('experience', first!.id))!;
    const original = job['skillIds'] as string[];
    const result = await service.save(
      'experience',
      job.id,
      { ...job, skillIds: [...original, 'skill.nope'] },
      job.rev,
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { [`skillIds.${original.length}`]: 'Unknown skill' },
    });
    expect((await store.get('experience', job.id))!['skillIds']).toEqual(original);
  });

  it('rejects education skills that do not exist', async () => {
    const { store, service } = setup();
    const [first] = await store.list('education');
    const entry = (await store.get('education', first!.id))!;
    const original = (entry['skillIds'] as string[] | undefined) ?? [];
    const result = await service.save(
      'education',
      entry.id,
      { ...entry, skillIds: [...original, 'skill.nope'] },
      entry.rev,
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { [`skillIds.${original.length}`]: 'Unknown skill' },
    });
    expect((await store.get('education', entry.id))!['skillIds'] ?? []).toEqual(original);
  });

  it('drops blank optional fields and blank list rows', async () => {
    const { store, service } = setup();
    const link = (await store.list('featuredLink'))[0]!;
    const full = (await store.get('featuredLink', link.id))!;
    const result = await service.save(
      'featuredLink',
      link.id,
      { ...full, placements: ['header'] },
      full.rev,
    );

    expect(result).toMatchObject({ ok: true });

    const contact = (await store.get('contact', 'contact'))!;
    const cleared = await service.save(
      'contact',
      null,
      { ...contact, phone: '', bookingUrl: '   ' },
      contact.rev,
    );

    expect(cleared).toMatchObject({ ok: true });

    const after = (await store.get('contact', 'contact'))!;

    expect(after).not.toHaveProperty('phone');
    expect(after).not.toHaveProperty('bookingUrl');
  });
});

describe('remove, flags and order', () => {
  it('blocks deleting a technology in use and lists who uses it', async () => {
    const { store, service } = setup();
    const project = await firstProject(store);
    const techId = (project['techIds'] as string[])[0]!;
    const result = await service.remove('technology', techId);

    expect(result).toMatchObject({ ok: false, kind: 'in-use' });

    if (!result.ok && result.kind === 'in-use') {
      expect(result.references.map((ref) => ref.id)).toContain(project.id);
    }
  });

  it('blocks deleting a skill linked from a project and lists who uses it', async () => {
    const { store, service } = setup();
    const project = await firstProject(store);
    const skillId = (project['skillIds'] as string[])[0]!;
    const result = await service.remove('skill', skillId);

    expect(result).toMatchObject({ ok: false, kind: 'in-use' });

    if (!result.ok && result.kind === 'in-use') {
      expect(result.references.map((ref) => ref.id)).toContain(project.id);
    }
  });

  it('blocks deleting a skill linked from an education entry and lists who uses it', async () => {
    const { store, service } = setup();
    const docs = await Promise.all(
      (await store.list('education')).map(async (item) => (await store.get('education', item.id))!),
    );
    const entry = docs.find((doc) => ((doc['skillIds'] as string[] | undefined) ?? []).length > 0)!;
    const skillId = (entry['skillIds'] as string[])[0]!;
    const result = await service.remove('skill', skillId);

    expect(result).toMatchObject({ ok: false, kind: 'in-use' });

    if (!result.ok && result.kind === 'in-use') {
      expect(result.references).toContainEqual(
        expect.objectContaining({ type: 'education', id: entry.id }),
      );
    }

    expect(await store.get('skill', skillId)).not.toBeNull();
  });

  it('blocks deleting a skill linked from an experience entry and lists who uses it', async () => {
    const { store, service } = setup();
    const [first] = await store.list('experience');
    const job = (await store.get('experience', first!.id))!;
    const skillId = (job['skillIds'] as string[])[0]!;
    const result = await service.remove('skill', skillId);

    expect(result).toMatchObject({ ok: false, kind: 'in-use' });

    if (!result.ok && result.kind === 'in-use') {
      expect(result.references.map((ref) => ref.id)).toContain(job.id);
    }
  });

  it('deletes a skill that no project, experience or education entry links', async () => {
    const { store, service, audits } = setup();
    const created = await service.save('skill', null, {
      name: { en: 'Unused skill', pt: 'Habilidade sem uso' },
      categories: ['frontend'],
      visible: true,
    });

    expect(created.ok).toBe(true);

    if (!created.ok) return;

    expect(await service.remove('skill', created.id)).toEqual({ ok: true });
    expect(await store.get('skill', created.id)).toBeNull();
    expect(audits.at(-1)).toBe('skill:delete');
  });

  it('deletes an unused document and refuses singletons', async () => {
    const { store, service, audits } = setup();
    const practice = (await store.list('practice'))[0]!;

    expect(await service.remove('practice', practice.id, practice.rev)).toEqual({ ok: true });
    expect(await store.get('practice', practice.id)).toBeNull();
    expect(audits.at(-1)).toBe('practice:delete');
    expect(await service.remove('profile', 'profile')).toEqual({
      ok: false,
      kind: 'singleton',
    });
  });

  it('toggles flags without validating the rest, even on a broken document', async () => {
    const { store, service } = setup();
    const link = (await store.list('featuredLink'))[0]!;

    await store.patch('featuredLink', link.id, {
      label: { en: 'only english' },
    });

    const hidden = await service.setFlag('featuredLink', link.id, 'visible', false);

    expect(hidden).toMatchObject({ ok: true });
    expect((await store.get('featuredLink', link.id))!['visible']).toBe(false);
  });

  it('reorders by renumbering only what changed', async () => {
    const { store, service } = setup();
    const ids = (await store.list('practice')).map((doc) => doc.id);
    const reversed = [...ids].reverse();

    expect(await service.reorder('practice', reversed)).toMatchObject({
      ok: true,
    });

    const after = await store.list('practice');

    expect(after.map((doc) => doc['order'])).toEqual(
      after.map((_, index) => (reversed.indexOf(after[index]!.id) + 1) * 10),
    );
  });
});

type Store = ReturnType<typeof setup>['store'];
type Owners = Record<'education' | 'experience' | 'project', AdminDoc[]>;

async function owners(store: Store): Promise<Owners> {
  return {
    project: await store.list('project'),
    experience: await store.list('experience'),
    education: await store.list('education'),
  };
}

const skillsOf = (doc: AdminDoc): string[] => (doc['skillIds'] as string[] | undefined) ?? [];
const byId = (docs: AdminDoc[], id: string): AdminDoc => docs.find((doc) => doc.id === id)!;

function usageOf(all: Owners, skill: string): Record<keyof Owners, string[]> {
  const linked = (docs: AdminDoc[]): string[] =>
    docs.filter((doc) => skillsOf(doc).includes(skill)).map((doc) => doc.id);

  return {
    project: linked(all.project),
    experience: linked(all.experience),
    education: linked(all.education),
  };
}

async function pickSkill(store: Store): Promise<{ all: Owners; skill: string }> {
  const all = await owners(store);
  const skill = skillsOf(all.project.find((doc) => skillsOf(doc).length > 0)!)[0]!;

  return { all, skill };
}

describe('saveSkillUsage', () => {
  it('adds and removes the skill, keeps order and only touches changed owners', async () => {
    const { store, service, revalidated, audits } = setup();
    const { all, skill } = await pickSkill(store);
    const usage = usageOf(all, skill);
    const removed = usage.project.pop()!;
    const entry = all.education.find((doc) => !skillsOf(doc).includes(skill))!;

    usage.education.push(entry.id);

    const result = await service.saveSkillUsage(skill, usage);
    const after = await owners(store);

    expect(result).toEqual({ ok: true, changed: 2 });
    expect(skillsOf(byId(after.project, removed))).toEqual(
      skillsOf(byId(all.project, removed)).filter((id) => id !== skill),
    );
    expect(skillsOf(byId(after.education, entry.id))).toEqual([...skillsOf(entry), skill]);

    for (const doc of after.experience) {
      expect(doc.rev).toBe(byId(all.experience, doc.id).rev);
    }

    expect(revalidated.some((item) => item.startsWith('project:'))).toBe(true);
    expect(revalidated).toContain('education:');
    expect(revalidated.some((item) => item.startsWith('experience:'))).toBe(false);
    expect(audits).toEqual(['skill:skill-usage']);
  });

  it('keeps the position of other skills when removing and appending', async () => {
    const { store, service } = setup();
    const { all, skill } = await pickSkill(store);
    const project = all.project.find((doc) => skillsOf(doc).includes(skill))!;
    const usage = usageOf(all, skill);

    usage.project = usage.project.filter((id) => id !== project.id);
    await service.saveSkillUsage(skill, usage);

    const without = skillsOf((await store.get('project', project.id))!);

    expect(without).toEqual(skillsOf(project).filter((id) => id !== skill));

    usage.project.push(project.id);
    await service.saveSkillUsage(skill, usage);

    expect(skillsOf((await store.get('project', project.id))!)).toEqual([...without, skill]);
  });

  it('is a no-op when the usage already matches', async () => {
    const { store, service, revalidated, audits } = setup();
    const { all, skill } = await pickSkill(store);
    const result = await service.saveSkillUsage(skill, usageOf(all, skill));
    const after = await owners(store);

    expect(result).toEqual({ ok: true, changed: 0 });
    expect(revalidated).toEqual([]);
    expect(audits).toEqual([]);
    expect(after).toEqual(all);
  });

  it('rejects unknown owner ids and writes nothing', async () => {
    const { store, service } = setup();
    const { all, skill } = await pickSkill(store);
    const result = await service.saveSkillUsage(skill, {
      ...usageOf(all, skill),
      project: ['project.unknown'],
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'invalid',
      fieldErrors: { 'project.0': 'Unknown project' },
    });
    expect(await owners(store)).toEqual(all);
  });

  it('reports a missing skill and a read-only store', async () => {
    const empty = { project: [], experience: [], education: [] };

    expect(await setup().service.saveSkillUsage('skill.nope', empty)).toEqual({
      ok: false,
      kind: 'missing',
    });
    expect(await setup(false).service.saveSkillUsage('x', empty)).toEqual({
      ok: false,
      kind: 'readonly',
    });
  });

  it('refuses to exceed an owner cap and names the owner', async () => {
    const { store, service } = setup();
    const { all, skill } = await pickSkill(store);
    const entry = all.education[0]!;
    const others = (await store.list('skill')).map((item) => item.id).filter((id) => id !== skill);

    expect(others.length).toBeGreaterThanOrEqual(24);

    await store.setSkillLinks([
      { type: 'education', id: entry.id, skillIds: others.slice(0, 24), expectedRev: entry.rev! },
    ]);

    const before = await owners(store);
    const usage = usageOf(before, skill);

    usage.project.pop();
    usage.education = [entry.id];

    const result = await service.saveSkillUsage(skill, usage);

    expect(result).toMatchObject({ ok: false, kind: 'invalid' });
    expect(JSON.stringify(result)).toContain('already has the maximum of 24 skills');
    expect(JSON.stringify(result)).toContain(
      (entry['title'] as { en: string } | undefined)?.en ?? entry.id,
    );
    expect(await owners(store)).toEqual(before);
  });

  it('rejects a usage with a missing owner list instead of unlinking everywhere', async () => {
    const { store, service, revalidated, audits } = setup();
    const { all, skill } = await pickSkill(store);
    const { project: _project, ...partial } = usageOf(all, skill);
    const result = await service.saveSkillUsage(skill, partial as never);

    expect(result).toMatchObject({ ok: false, kind: 'invalid' });
    expect(result).toHaveProperty('fieldErrors.project');
    expect(await owners(store)).toEqual(all);
    expect(revalidated).toEqual([]);
    expect(audits).toEqual([]);
  });

  it('points a field error at the row the caller sent, even after a repeated id', async () => {
    const { store, service } = setup();
    const { all, skill } = await pickSkill(store);
    const result = await service.saveSkillUsage(skill, {
      ...usageOf(all, skill),
      project: ['project.unknown', 'project.unknown', 'project.other'],
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'invalid',
      fieldErrors: {
        'project.0': 'Unknown project',
        'project.1': 'Unknown project',
        'project.2': 'Unknown project',
      },
    });
  });

  it.each([
    ['project', 32],
    ['experience', 48],
  ] as const)('refuses to exceed the %s cap of %i', async (type, cap) => {
    const { store, service } = setup();
    const { all, skill } = await pickSkill(store);
    const entry = all[type].find((doc) => !skillsOf(doc).includes(skill))!;
    const filler = Array.from({ length: cap }, (_, index) => `skill.filler-${index}`);

    await store.setSkillLinks([{ type, id: entry.id, skillIds: filler, expectedRev: entry.rev! }]);

    const before = await owners(store);
    const usage = usageOf(before, skill);

    usage[type].push(entry.id);

    const result = await service.saveSkillUsage(skill, usage);

    expect(result).toMatchObject({ ok: false, kind: 'invalid' });
    expect(JSON.stringify(result)).toContain(`already has the maximum of ${cap} skills`);
    expect(await owners(store)).toEqual(before);
  });

  it('forwards a missing owner reported by the store', async () => {
    const { store, revalidated, audits } = setup();
    const { all, skill } = await pickSkill(store);
    const entry = all.education.find((doc) => !skillsOf(doc).includes(skill))!;
    const usage = usageOf(all, skill);

    usage.education.push(entry.id);

    const service = createAdminService(
      { ...store, setSkillLinks: async () => ({ ok: false, reason: 'missing' }) },
      {
        revalidate: (type) => revalidated.push(type),
        audit: (event) => audits.push(event.action),
        now: () => new Date(),
      },
    );

    expect(await service.saveSkillUsage(skill, usage)).toEqual({ ok: false, kind: 'missing' });
    expect(revalidated).toEqual([]);
    expect(audits).toEqual([]);
  });

  it('leaves every owner unchanged on a conflict', async () => {
    const { store, revalidated, audits } = setup();
    const { all, skill } = await pickSkill(store);
    const entry = all.education.find((doc) => !skillsOf(doc).includes(skill))!;
    const usage = usageOf(all, skill);

    usage.project.pop();
    usage.education.push(entry.id);

    const service = createAdminService(
      {
        ...store,
        setSkillLinks: (changes) =>
          store.setSkillLinks(
            changes.map((change, index) =>
              index === 1 ? { ...change, expectedRev: 'stale' } : change,
            ),
          ),
      },
      {
        revalidate: (type) => revalidated.push(type),
        audit: (event) => audits.push(event.action),
        now: () => new Date(),
      },
    );
    const result = await service.saveSkillUsage(skill, usage);

    expect(result).toEqual({ ok: false, kind: 'conflict' });
    expect(await owners(store)).toEqual(all);
    expect(revalidated).toEqual([]);
    expect(audits).toEqual([]);
  });
});
