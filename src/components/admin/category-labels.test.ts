import { describe, expect, it } from 'vitest';

import { skillCategories, techCategories } from '@/lib/content/taxonomy';

import { categoryOptions, isSkillCategory } from './category-labels';

describe('categoryOptions', () => {
  it('keeps the seven technology categories and their labels', () => {
    expect(categoryOptions(techCategories)).toEqual([
      { value: 'language', label: 'Languages' },
      { value: 'frontend', label: 'Frontend' },
      { value: 'backend', label: 'Backend & APIs' },
      { value: 'data', label: 'Data & messaging' },
      { value: 'cloud', label: 'Cloud & DevOps' },
      { value: 'integration', label: 'Integrations & automation' },
      { value: 'ai', label: 'AI agents & tooling' },
    ]);
  });

  it('adds software engineering last for skills', () => {
    const options = categoryOptions(skillCategories);

    expect(options).toHaveLength(8);
    expect(options.at(-1)).toEqual({ value: 'engineering', label: 'Software engineering' });
  });

  it('recognizes only known categories', () => {
    expect(isSkillCategory('ai')).toBe(true);
    expect(isSkillCategory('nope')).toBe(false);
  });
});
