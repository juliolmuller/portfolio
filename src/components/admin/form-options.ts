import 'server-only';

import { type AdminStore } from '@/lib/content/admin';

import { type AreaConfig, type FormOptions } from './area-config';

type Flags = Pick<AreaConfig, 'needsSkills' | 'needsTechnologies'>;

/**
 * Builds the pick-lists an area's form needs, reading only what its flags ask
 * for.
 */
export async function loadFormOptions(store: AdminStore, config: Flags): Promise<FormOptions> {
  const [skillOptions, techOptions] = await Promise.all([
    config.needsSkills ? loadSkillOptions(store) : [],
    config.needsTechnologies ? loadTechOptions(store) : [],
  ]);

  return { skillOptions, techOptions };
}

async function loadSkillOptions(store: AdminStore): Promise<FormOptions['skillOptions']> {
  const options = (await store.list('skill')).map((skill) => ({
    value: skill.id,
    label: (skill['name'] as { en?: string } | undefined)?.en || skill.id,
  }));

  return options.sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));
}

async function loadTechOptions(store: AdminStore): Promise<FormOptions['techOptions']> {
  return (await store.list('technology')).map((tech) => ({
    value: tech.id,
    label: String(tech['name'] ?? tech.id),
  }));
}
