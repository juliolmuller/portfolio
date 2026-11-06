'use client';

import { titleFontLabels, titleFonts } from '@/lib/content/taxonomy';

import {
  LocalizedField,
  NumberField,
  Section,
  SelectField,
  TextField,
  ToggleField,
} from '../editor/fields';
import { useForm } from '../editor/form';
import { ImageField, PdfField } from '../editor/image-field';
import { ListEditor } from '../editor/list-editor';

const blank = (): { en: string; pt: string } => ({ en: '', pt: '' });

export function ProfileForm(): React.JSX.Element {
  return (
    <>
      <Section title="Identity">
        <TextField path="displayName" label="Display name" maxLength={80} />
        <LocalizedField path="jobTitle" label="Job title" max={80} />
        <LocalizedField path="location" label="Location" max={80} />
        <LocalizedField path="focus" label="Current focus" max={120} />
        <ListEditor
          path="spokenLanguages"
          label="Spoken languages"
          itemLabel="language"
          min={1}
          max={6}
          newItem={blank}
        >
          {(_, itemPath) => <LocalizedField path={itemPath} label="Language" max={60} />}
        </ListEditor>
      </Section>

      <Section title="Hero">
        <LocalizedField path="heroLead" label="Lead paragraph" max={120} multiline />
        <SelectField
          path="titleFont"
          label="Title font"
          hint="Used for your name in the hero."
          emptyLabel="Geist (default)"
          options={titleFonts.map((value) => ({
            value,
            label: titleFontLabels[value],
            fontFamily: `var(--font-title-${value})`,
          }))}
        />
        <ImageField path="photo" label="Photo (square, hero and social image)" />
        <ImageField path="photoLg" label="Large photo (3:4, from large screens up)" />
      </Section>

      <Section title="About">
        <LocalizedField path="bio" label="Bio (Markdown)" max={1500} markdown />
        <ListEditor
          path="metrics"
          label="Metrics"
          itemLabel="metric"
          max={4}
          newItem={() => ({ value: '', label: blank() })}
        >
          {(_, itemPath) => (
            <>
              <TextField
                path={`${itemPath}.value`}
                label="Value"
                maxLength={12}
                hint="Shown as is, e.g. 12+"
              />
              <LocalizedField path={`${itemPath}.label`} label="Label" max={48} />
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField
                  path={`${itemPath}.countTo`}
                  label="Count up to"
                  min={0}
                  hint="Optional animation target"
                />
                <TextField path={`${itemPath}.prefix`} label="Prefix" maxLength={4} />
                <TextField path={`${itemPath}.suffix`} label="Suffix" maxLength={4} />
              </div>
            </>
          )}
        </ListEditor>
      </Section>
    </>
  );
}

export function ContactForm(): React.JSX.Element {
  return (
    <Section title="Contact details">
      <TextField path="email" label="Email" type="email" maxLength={254} />
      <TextField
        path="phone"
        label="Phone (optional)"
        type="tel"
        hint="International format, e.g. +5541999990000"
      />
      <ToggleField
        path="showPhone"
        label="Show the phone number publicly"
        hint="Off by default. When off, the number is never sent to visitors."
      />
      <TextField path="bookingUrl" label="Booking link (optional)" type="url" hint="https only" />
      <LocalizedField path="ctaHeading" label="Contact heading" max={80} />
      <LocalizedField path="ctaText" label="Contact text" max={280} multiline />
    </Section>
  );
}

export function ResumeForm(): React.JSX.Element {
  const form = useForm();
  const updated = form.get('updatedAt');

  return (
    <Section
      title="Résumé files"
      description="One PDF per language. Visitors get the file that matches the site language."
    >
      <PdfField path="file.en" label="English PDF" />
      <PdfField path="file.pt" label="Portuguese PDF" />
      {typeof updated === 'string' ? (
        <p className="text-small text-text-3">
          Last saved {new Date(updated).toLocaleString('en')}
        </p>
      ) : null}
    </Section>
  );
}
