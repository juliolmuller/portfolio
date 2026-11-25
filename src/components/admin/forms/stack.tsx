'use client';

import { techCategories } from '@/lib/content/taxonomy';

import { categoryOptions } from '../category-labels';
import { LocalizedField, Section, SelectField, TextField, ToggleField } from '../editor/fields';
import { TechIconFields } from '../editor/icon-fields';

export const PROMINENCE_OPTIONS = [
  { value: 1, label: '1 · Core (largest)' },
  { value: 2, label: '2 · Regular' },
  { value: 3, label: '3 · Occasional (smallest)' },
];

export function TechnologyForm(): React.JSX.Element {
  return (
    <>
      <Section title="Technology">
        <TextField path="name" label="Name" maxLength={40} />
        <SelectField path="category" label="Category" options={categoryOptions(techCategories)} />
        <SelectField
          path="priority"
          label="Prominence"
          hint="How large it appears in the technology cloud."
          options={PROMINENCE_OPTIONS}
        />
        <TextField path="url" label="Website (optional)" type="url" />
        <TextField
          path="brandColor"
          label="Brand color (optional)"
          mono
          placeholder="#8b7cff"
          maxLength={7}
        />
        <ToggleField path="visible" label="Visible on the site" />
      </Section>
      <Section title="Icon">
        <TechIconFields />
      </Section>
    </>
  );
}

export function PracticeForm(): React.JSX.Element {
  return (
    <Section title="Practice">
      <LocalizedField path="label" label="Label" max={60} />
      <ToggleField path="visible" label="Visible on the site" />
    </Section>
  );
}
