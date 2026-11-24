'use client';

import { skillCategories } from '@/lib/content/taxonomy';

import { categoryOptions } from '../category-labels';
import {
  CheckboxGroup,
  LocalizedField,
  Section,
  SelectField,
  TextField,
  ToggleField,
} from '../editor/fields';
import { useForm } from '../editor/form';
import { TechIconFields } from '../editor/icon-fields';
import { PROMINENCE_OPTIONS } from './stack';

export function SkillForm(): React.JSX.Element {
  const form = useForm();
  const hasIcon = Boolean(form.get('iconSource'));

  return (
    <>
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
      <Section title="Icon">
        <TechIconFields allowNone namePath="name.en" />
      </Section>
      <Section title="Skills cloud">
        <ToggleField
          path="showInCloud"
          label="Show in the skills cloud"
          disabled={!hasIcon}
          hint={
            hasIcon
              ? 'Shown in the 3D cloud on the home page.'
              : 'Add an icon to show this skill in the cloud.'
          }
        />
        <SelectField
          path="priority"
          label="Prominence"
          hint="How large it appears in the cloud. Only matters in the cloud."
          options={PROMINENCE_OPTIONS}
        />
        <TextField
          path="brandColor"
          label="Brand color (optional)"
          mono
          placeholder="#8b7cff"
          maxLength={7}
        />
      </Section>
    </>
  );
}
