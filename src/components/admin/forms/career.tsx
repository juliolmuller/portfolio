'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  CheckboxGroup,
  LocalizedField,
  Section,
  SelectField,
  TextField,
  ToggleField,
} from '../editor/fields';
import { ListEditor } from '../editor/list-editor';
import { smallButton } from '../editor/styles';

export interface Option {
  label: string;
  value: string;
}

const blank = (): { en: string; pt: string } => ({ en: '', pt: '' });

export function ExperienceForm({ techOptions }: { techOptions: Option[] }): React.JSX.Element {
  const router = useRouter();

  return (
    <>
      <Section title="Company">
        <TextField path="company" label="Company" maxLength={80} />
        <TextField path="companyUrl" label="Company website (optional)" type="url" />
        <LocalizedField path="location" label="Location (optional)" max={80} />
        <ToggleField path="collapsedByDefault" label="Collapsed by default on the site" />
        <ToggleField path="visible" label="Visible on the site" />
      </Section>

      <Section
        title="Roles"
        description="Newest first. Dates are year and month, like 2024-03; leave the end empty for a current role."
      >
        <ListEditor
          path="roles"
          label="Roles"
          itemLabel="role"
          min={1}
          max={10}
          newItem={() => ({
            title: blank(),
            start: '',
            summary: blank(),
            bullets: [],
          })}
        >
          {(_, itemPath) => (
            <>
              <LocalizedField path={`${itemPath}.title`} label="Title" max={80} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  path={`${itemPath}.start`}
                  label="Start (YYYY-MM)"
                  mono
                  placeholder="2022-01"
                  maxLength={7}
                />
                <TextField
                  path={`${itemPath}.end`}
                  label="End (YYYY-MM, optional)"
                  mono
                  placeholder="2024-03"
                  maxLength={7}
                />
              </div>
              <LocalizedField path={`${itemPath}.summary`} label="Summary" max={5000} multiline />
              <ListEditor
                path={`${itemPath}.bullets`}
                label="Highlights"
                itemLabel="highlight"
                max={6}
                newItem={blank}
              >
                {(__, bulletPath) => (
                  <LocalizedField path={bulletPath} label="Highlight" max={200} />
                )}
              </ListEditor>
            </>
          )}
        </ListEditor>
      </Section>

      <Section title="Technologies">
        <CheckboxGroup
          path="techIds"
          label="Technologies used"
          options={techOptions}
          max={32}
          hint={
            <>
              Missing one? Add it in{' '}
              <Link
                href="/admin/technologies"
                target="_blank"
                prefetch={false}
                className="underline"
              >
                Technologies (opens in a new tab)
              </Link>
              , then{' '}
              {/* refresh() re-reads techOptions on the server and keeps the unsaved form state. */}
              <button type="button" onClick={() => router.refresh()} className={smallButton}>
                Refresh the list
              </button>
            </>
          }
        />
      </Section>
    </>
  );
}

export function EducationForm(): React.JSX.Element {
  return (
    <Section title="Education">
      <SelectField
        path="kind"
        label="Kind"
        options={[
          { value: 'degree', label: 'Degree' },
          { value: 'certification', label: 'Certification' },
        ]}
      />
      <LocalizedField path="title" label="Title" max={120} />
      <TextField path="institution" label="Institution" maxLength={120} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField path="start" label="Start (YYYY or YYYY-MM, optional)" mono maxLength={7} />
        <TextField path="end" label="End (YYYY or YYYY-MM, optional)" mono maxLength={7} />
      </div>
      <TextField path="url" label="Credential URL (optional)" type="url" />
      <ToggleField path="visible" label="Visible on the site" />
    </Section>
  );
}
