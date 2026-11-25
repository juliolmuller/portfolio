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
import { type FormApi, useForm } from '../editor/form';
import { TechIconFields } from '../editor/icon-fields';
import { PROMINENCE_OPTIONS } from './stack';

/**
 * An icon counts once its source has what the schema asks for (a name for
 * Simple Icons and Devicon, an applied SVG for Custom SVG); a monogram is
 * always generated.
 */
function hasIcon(form: FormApi): boolean {
  switch (form.get('iconSource')) {
    case 'custom-svg':
      return Boolean(form.get('customSvg'));
    case 'devicon':
    case 'simple-icons':
      return Boolean(form.get('iconSlug'));
    case 'monogram':
      return true;
    default:
      return false;
  }
}

export function SkillForm(): React.JSX.Element {
  const form = useForm();
  const iconSet = hasIcon(form);

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
          disabled={!iconSet}
          hint={
            iconSet
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
