import { describe, expect, it } from 'vitest';

import { createFixturesAdminStore } from '@/lib/content/admin/fixtures-store';
import { createFixtureDataset } from '@/lib/content/fixtures/dataset';

import { loadFormOptions } from './form-options';

const store = createFixturesAdminStore(createFixtureDataset(), {
  readOnlyReason: 'test',
  writable: false,
});

describe('loadFormOptions', () => {
  it('gives projects sorted skill options and no technologies', async () => {
    const options = await loadFormOptions(store, { needsSkills: true });
    const skills = await store.list('skill');
    const labels = options.skillOptions.map((option) => option.label);

    expect(options.techOptions).toEqual([]);
    expect(options.skillOptions).toHaveLength(skills.length);
    expect(new Set(options.skillOptions.map((option) => option.value))).toEqual(
      new Set(skills.map((skill) => skill.id)),
    );
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
    );

    const first = skills[0]!;
    const option = options.skillOptions.find((item) => item.value === first.id);

    expect(option?.label).toBe((first['name'] as { en: string }).en);
  });

  it('gives experience technologies and no skills', async () => {
    const options = await loadFormOptions(store, { needsTechnologies: true });

    expect(options.skillOptions).toEqual([]);
    expect(options.techOptions.length).toBeGreaterThan(0);
  });

  it('gives an area with neither flag nothing', async () => {
    await expect(loadFormOptions(store, {})).resolves.toEqual({
      skillOptions: [],
      techOptions: [],
    });
  });
});
