import { skillCategories, type SkillCategory } from '@/lib/content/taxonomy';

/**
 * English category labels for the admin UI. Public labels come from the
 * `messages/*` catalogs; admin copy is English only.
 */
export const skillCategoryLabels: Record<SkillCategory, string> = {
  language: 'Languages',
  frontend: 'Frontend',
  backend: 'Backend & APIs',
  data: 'Data & messaging',
  cloud: 'Cloud & DevOps',
  integration: 'Integrations & automation',
  ai: 'AI agents & tooling',
  engineering: 'Software engineering',
};

export const isSkillCategory = (value: string): value is SkillCategory =>
  (skillCategories as readonly string[]).includes(value);

/**
 * Select/checkbox options for the given categories, in the order of `keys`.
 */
export const categoryOptions = (
  keys: readonly SkillCategory[],
): Array<{ label: string; value: string }> =>
  keys.map((value) => ({ value, label: skillCategoryLabels[value] }));
