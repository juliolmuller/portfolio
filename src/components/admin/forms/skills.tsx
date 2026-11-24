'use client';

import { skillCategories } from '@/lib/content/taxonomy';

import { categoryOptions } from '../category-labels';
import { CheckboxGroup, LocalizedField, Section, TextField, ToggleField } from '../editor/fields';

export function SkillForm(): React.JSX.Element {
  return (
    <Section title="Skill">
      <LocalizedField path="name" label="Name" max={60} />
      <CheckboxGroup
        path="categories"
        label="Categories"
        hint="Tick the main category first; the list shows them in stored order."
        options={categoryOptions(skillCategories)}
      />
      <TextField path="url" label="Website (optional)" type="url" />
      <ToggleField path="visible" label="Visible on the site" />
    </Section>
  );
}
