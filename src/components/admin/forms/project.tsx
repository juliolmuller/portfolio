'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  CheckboxGroup,
  LocalizedField,
  NumberField,
  Section,
  SelectField,
  TextField,
  ToggleField,
} from '../editor/fields';
import { useForm } from '../editor/form';
import { ImageField } from '../editor/image-field';
import { ListEditor } from '../editor/list-editor';
import { smallButton } from '../editor/styles';
import { type Option } from './career';

const blank = (): { en: string; pt: string } => ({ en: '', pt: '' });

const KINDS = ['web', 'mobile', 'desktop', 'automation', 'integration', 'open-source'];
const STATUSES = [
  { value: 'live', label: 'Live' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'archived', label: 'Archived' },
  { value: 'private', label: 'Private (no public links)' },
];

interface GalleryItem {
  alt?: { en?: string };
  asset?: { height: number; lqip?: string; url: string; width: number };
}

export function ProjectForm({ skillOptions }: { skillOptions: Option[] }): React.JSX.Element {
  const router = useRouter();
  const form = useForm();
  const gallery = ((form.get('gallery') as GalleryItem[] | undefined) ?? []).flatMap((item) =>
    item.asset ? [{ ...item.asset, alt: item.alt?.en ?? '' }] : [],
  );
  const previous = (form.get('previousSlugs') as string[] | undefined) ?? [];

  return (
    <>
      <Section title="Basics">
        <LocalizedField
          path="title"
          label="Title"
          max={80}
          range={[1, 60]}
          hint="Search results cut titles after about 60 characters."
        />
        <LocalizedField path="tagline" label="Tagline" max={90} />
        <LocalizedField
          path="summary"
          label="Summary"
          max={160}
          range={[70, 160]}
          multiline
          rows={3}
          hint="Also the meta description."
        />
        <TextField
          path="slug"
          label="Slug"
          mono
          maxLength={80}
          hint={
            previous.length > 0
              ? `Changing it keeps old links working. Old slugs: ${previous.join(', ')}.`
              : 'Part of the URL. Changing it later keeps the old link working.'
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField path="year" label="Year" min={1990} max={2100} />
          <SelectField
            path="kind"
            label="Kind"
            options={KINDS.map((value) => ({ value, label: value }))}
          />
          <SelectField path="status" label="Status" options={STATUSES} />
        </div>
        <LocalizedField path="role" label="My role" max={80} />
        <ToggleField
          path="featured"
          label="Featured"
          hint="Featured projects appear on Home (up to 6) and first on the projects page."
        />
        <ToggleField path="visible" label="Visible on the site" />
      </Section>

      <Section title="The story">
        <LocalizedField path="context" label="Context" max={1200} multiline rows={5} />
        <LocalizedField path="approach" label="Approach" max={1200} multiline rows={5} />
        <ListEditor
          path="highlights"
          label="Highlights"
          itemLabel="highlight"
          min={3}
          max={5}
          newItem={blank}
        >
          {(_, itemPath) => <LocalizedField path={itemPath} label="Highlight" max={160} />}
        </ListEditor>
        <LocalizedField path="outcome" label="Outcome (optional)" max={400} multiline rows={3} />
        <LocalizedField
          path="body"
          label="Full write-up (optional, Markdown)"
          max={20000}
          markdown
          gallery={gallery}
          hint="Pictures come from the gallery below: ![alt](gallery:1)."
        />
      </Section>

      <Section title="Links and skills">
        <TextField path="links.live" label="Live URL (optional)" type="url" />
        <TextField path="links.repo" label="Repository URL (optional)" type="url" />
        <CheckboxGroup
          path="skillIds"
          label="Skills"
          options={skillOptions}
          max={32}
          hint={
            <>
              Missing one? Add it in{' '}
              <Link href="/admin/skills" target="_blank" prefetch={false} className="underline">
                Skills (opens in a new tab)
              </Link>
              , then{' '}
              {/* refresh() re-reads skillOptions on the server and keeps the unsaved form state. */}
              <button type="button" onClick={() => router.refresh()} className={smallButton}>
                Refresh the list
              </button>
            </>
          }
        />
      </Section>

      <Section title="Images">
        <ImageField path="cover" label="Cover image" />
        <ListEditor path="gallery" label="Gallery" itemLabel="image" max={12} newItem={() => ({})}>
          {(_, itemPath) => (
            <>
              <ImageField path={itemPath} label="Image" />
              <LocalizedField path={`${itemPath}.caption`} label="Caption (optional)" max={160} />
            </>
          )}
        </ListEditor>
      </Section>
    </>
  );
}
