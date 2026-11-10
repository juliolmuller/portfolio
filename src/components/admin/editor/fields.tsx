'use client';

import { ChevronDown } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { fieldId } from '@/lib/admin/path';
import { cn } from '@/lib/cn';

import { useForm } from './form';
import { MarkdownEditor } from './markdown-editor';
import { hintClass, inputClass, labelClass, smallButton } from './styles';

interface ControlProps {
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'disabled': boolean;
  'id': string;
}

interface FieldProps {
  children: (props: ControlProps) => ReactNode;
  hint?: ReactNode;
  label: string;
  path: string;
}

/**
 * Label, hint and error wiring (`aria-describedby`, `aria-invalid`) for one
 * control.
 */
export function Field({ path, label, hint, children }: FieldProps): React.JSX.Element {
  const form = useForm();
  const id = fieldId(path);
  const error = form.error(path);
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')
    || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'disabled': form.disabled,
      })}
      {hint ? (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

export function TextField({
  path,
  label,
  hint,
  type = 'text',
  mono,
  maxLength,
  placeholder,
}: {
  hint?: ReactNode;
  label: string;
  maxLength?: number;
  mono?: boolean;
  path: string;
  placeholder?: string;
  type?: 'email' | 'tel' | 'text' | 'url';
}): React.JSX.Element {
  const form = useForm();

  return (
    <Field path={path} label={label} hint={hint}>
      {(props) => (
        <input
          {...props}
          type={type}
          value={asText(form.get(path))}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={type === 'text'}
          onChange={(event) => form.set(path, event.target.value)}
          className={cn(inputClass, mono && 'font-mono')}
        />
      )}
    </Field>
  );
}

export function TextAreaField({
  path,
  label,
  hint,
  rows = 4,
  maxLength,
}: {
  hint?: ReactNode;
  label: string;
  maxLength?: number;
  path: string;
  rows?: number;
}): React.JSX.Element {
  const form = useForm();
  const value = asText(form.get(path));

  return (
    <Field
      path={path}
      label={label}
      hint={
        <>
          {hint} {maxLength ? `${value.length}/${maxLength}` : null}
        </>
      }
    >
      {(props) => (
        <textarea
          {...props}
          rows={rows}
          value={value}
          onChange={(event) => form.set(path, event.target.value)}
          className={inputClass}
        />
      )}
    </Field>
  );
}

export function NumberField({
  path,
  label,
  hint,
  min,
  max,
}: {
  hint?: ReactNode;
  label: string;
  max?: number;
  min?: number;
  path: string;
}): React.JSX.Element {
  const form = useForm();
  const value = form.get(path);

  return (
    <Field path={path} label={label} hint={hint}>
      {(props) => (
        <input
          {...props}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) =>
            form.set(path, event.target.value === '' ? undefined : Number(event.target.value))
          }
          className={inputClass}
        />
      )}
    </Field>
  );
}

export function SelectField({
  path,
  label,
  hint,
  options,
  emptyLabel,
}: {
  /**
   * Optional field: an always-available empty choice that unsets it.
   */
  emptyLabel?: string;
  hint?: ReactNode;
  label: string;
  options: ReadonlyArray<{ fontFamily?: string; label: string; value: number | string }>;
  path: string;
}): React.JSX.Element {
  const form = useForm();
  const value = form.get(path);
  const selected = options.find((option) => String(option.value) === String(value));

  return (
    <Field path={path} label={label} hint={hint}>
      {(props) => (
        <select
          style={{ fontFamily: selected?.fontFamily }}
          {...props}
          value={value === undefined ? '' : String(value)}
          onChange={(event) => {
            const chosen = options.find((option) => String(option.value) === event.target.value);

            form.set(
              path,
              event.target.value === '' && emptyLabel
                ? undefined
                : (chosen?.value ?? event.target.value),
            );
          }}
          className={inputClass}
        >
          {emptyLabel || value === undefined || value === '' ? (
            // The select takes the chosen option's font; keep this one in the UI font.
            <option value="" style={{ fontFamily: 'var(--font-sans)' }}>
              {emptyLabel ?? 'Choose…'}
            </option>
          ) : null}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              style={{ fontFamily: option.fontFamily }}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function ToggleField({
  path,
  label,
  hint,
}: {
  hint?: ReactNode;
  label: string;
  path: string;
}): React.JSX.Element {
  const form = useForm();
  const id = fieldId(path);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={form.get(path) === true}
          disabled={form.disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => form.set(path, event.target.checked)}
          className="size-5 accent-accent-1"
        />
        <span className={labelClass}>{label}</span>
      </label>
      {hint ? (
        <p id={`${id}-hint`} className={cn(hintClass, 'pl-8')}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A set of checkboxes bound to a string array (placements, technologies).
 */
export function CheckboxGroup({
  path,
  label,
  hint,
  options,
  max,
}: {
  hint?: ReactNode;
  label: string;
  max?: number;
  options: ReadonlyArray<{ label: string; value: string }>;
  path: string;
}): React.JSX.Element {
  const form = useForm();
  const [query, setQuery] = useState('');
  const selected = (form.get(path) as string[] | undefined) ?? [];
  const error = form.error(path);
  const id = fieldId(path);
  const shown = options.filter(
    (option) =>
      selected.includes(option.value) || option.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-describedby={error ? `${id}-error` : undefined}
      className="flex flex-col gap-2 outline-none"
    >
      <legend className={labelClass}>
        {label}
        {max ? (
          <span className="ml-2 font-normal text-text-3">
            {selected.length}/{max}
          </span>
        ) : null}
      </legend>
      {options.length > 8 ? (
        <input
          type="search"
          aria-label={`Filter ${label.toLowerCase()}`}
          placeholder="Filter…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={inputClass}
        />
      ) : null}
      <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
        {shown.map((option) => {
          const on = selected.includes(option.value);

          return (
            <label
              key={option.value}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-small',
                on ? 'border-accent-1 text-text-1' : 'border-line-strong text-text-2',
              )}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={form.disabled || (!on && max !== undefined && selected.length >= max)}
                onChange={() =>
                  form.set(
                    path,
                    on
                      ? selected.filter((value) => value !== option.value)
                      : [...selected, option.value],
                  )
                }
                className="accent-accent-1"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {hint ? <p className={hintClass}>{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

interface LocalizedProps {
  /**
   * Images that `![alt](gallery:N)` may point at (markdown only).
   */
  gallery?: Array<{
    alt: string;
    height: number;
    lqip?: string;
    url: string;
    width: number;
  }>;
  hint?: ReactNode;
  label: string;
  markdown?: boolean;
  max: number;
  multiline?: boolean;
  /**
   * Appended to the counter once the text passes `max` (only zod blocks saves).
   */
  overMaxNote?: string;
  path: string;
  /**
   * Recommended length range (SEO), shown as guidance.
   */
  range?: [number, number];
  rows?: number;
}

/**
 * Discreet dropdown that copies one language into the other.
 */
function CopyMenu({
  label,
  disabled,
  canCopyToPt,
  canCopyToEn,
  onCopyToPt,
  onCopyToEn,
}: {
  canCopyToEn: boolean;
  canCopyToPt: boolean;
  disabled: boolean;
  label: string;
  onCopyToEn: () => void;
  onCopyToPt: () => void;
}): React.JSX.Element {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: Event): void => {
      const el = ref.current;

      if (!el?.open) return;

      if (event.type === 'keydown') {
        if ((event as KeyboardEvent).key !== 'Escape') return;

        el.querySelector('summary')?.focus();
      } else if (el.contains(event.target as Node)) return;

      el.open = false;
    };

    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);

    return (): void => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  const item =
    'flex min-h-11 w-full items-center rounded px-3 text-left text-small font-normal text-text-1 hover-fine:bg-surface-2 disabled:opacity-40';
  const pick = (action: () => void) => (): void => {
    action();

    if (ref.current) ref.current.open = false;
  };

  return (
    <details ref={ref} className="relative ml-auto">
      <summary
        aria-label={`${label}: copy between languages`}
        aria-disabled={disabled || undefined}
        onClick={(event) => disabled && event.preventDefault()}
        className={cn(
          smallButton,
          'cursor-pointer list-none gap-1 px-2 text-text-2 marker:hidden [&::-webkit-details-marker]:hidden',
          disabled && 'opacity-40',
        )}
      >
        Copy
        <ChevronDown aria-hidden className="size-4" />
      </summary>
      <div
        role="group"
        aria-label={`${label}: copy between languages`}
        className="absolute right-0 z-10 mt-1 flex w-56 flex-col rounded-md border border-line-strong bg-surface-1 p-1 shadow-lg"
      >
        <button type="button" disabled={!canCopyToPt} onClick={pick(onCopyToPt)} className={item}>
          Copy English to Portuguese
        </button>
        <button type="button" disabled={!canCopyToEn} onClick={pick(onCopyToEn)} className={item}>
          Copy Portuguese to English
        </button>
      </div>
    </details>
  );
}

/**
 * English and Portuguese inputs side by side from 1024 px, as tabs below.
 */
export function LocalizedField({
  path,
  label,
  hint,
  max,
  multiline,
  rows = 3,
  markdown,
  range,
  gallery,
  overMaxNote,
}: LocalizedProps): React.JSX.Element {
  const form = useForm();
  const [tab, setTab] = useState<'en' | 'pt'>('en');
  const en = asText(form.get(`${path}.en`));
  const pt = asText(form.get(`${path}.pt`));
  const complete = en.trim() !== '' && pt.trim() !== '';
  const status = complete
    ? 'Both languages filled'
    : en.trim() === '' && pt.trim() === ''
      ? 'Empty'
      : en.trim() === ''
        ? 'English missing'
        : 'Portuguese missing';

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cn(labelClass, 'flex w-full flex-wrap items-center gap-3')}>
        {label}
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs font-normal',
            complete ? 'border-line text-text-3' : 'border-warn/60 text-warn',
          )}
        >
          {status}
        </span>
        <CopyMenu
          label={label}
          disabled={form.disabled}
          canCopyToPt={en.trim() !== ''}
          canCopyToEn={pt.trim() !== ''}
          onCopyToPt={() => form.set(`${path}.pt`, en)}
          onCopyToEn={() => form.set(`${path}.en`, pt)}
        />
      </legend>

      <div
        className="flex flex-wrap items-center gap-2 lg:hidden"
        role="group"
        aria-label={`${label} language`}
      >
        {(['en', 'pt'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            aria-pressed={tab === lang}
            onClick={() => setTab(lang)}
            className={cn(smallButton, tab === lang && 'bg-surface-2')}
          >
            {lang === 'en' ? 'English' : 'Português'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(['en', 'pt'] as const).map((lang) => {
          const value = lang === 'en' ? en : pt;
          const childPath = `${path}.${lang}`;
          const error = form.error(childPath);
          const id = fieldId(childPath);
          const outOfRange =
            range && value.length > 0 && (value.length < range[0] || value.length > range[1]);
          const describedBy = [`${id}-count`, error ? `${id}-error` : null]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={lang}
              className={cn('flex-col gap-1.5', tab === lang ? 'flex' : 'hidden', 'lg:flex')}
            >
              <label htmlFor={id} className="text-xs text-text-3">
                {lang === 'en' ? 'English' : 'Português'}
              </label>
              {markdown ? (
                <MarkdownEditor
                  id={id}
                  value={value}
                  onChange={(next) => form.set(childPath, next)}
                  disabled={form.disabled}
                  invalid={Boolean(error)}
                  describedBy={describedBy}
                  gallery={gallery ?? []}
                />
              ) : multiline ? (
                <textarea
                  id={id}
                  rows={rows}
                  value={value}
                  disabled={form.disabled}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => form.set(childPath, event.target.value)}
                  className={inputClass}
                />
              ) : (
                <input
                  id={id}
                  value={value}
                  disabled={form.disabled}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy}
                  autoComplete="off"
                  onChange={(event) => form.set(childPath, event.target.value)}
                  className={inputClass}
                />
              )}
              <p
                id={`${id}-count`}
                className={cn(hintClass, (value.length > max || outOfRange) && 'text-warn')}
              >
                {value.length}/{max}
                {range ? ` · aim for ${range[0]}–${range[1]}` : ''}
                {overMaxNote && value.length > max ? ` · ${overMaxNote}` : ''}
              </p>
              {error ? (
                <p id={`${id}-error`} className="text-small text-danger">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {complete && en.trim() === pt.trim() && en.trim().length > 12 ? (
        <p className="text-small text-warn">
          English and Portuguese are identical. Fine for names, otherwise translate.
        </p>
      ) : null}
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </fieldset>
  );
}

export function Section({
  title,
  children,
  description,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-line p-5">
      <div>
        <h2 className="text-h3">{title}</h2>
        {description ? <p className="mt-1 text-small text-text-3">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
