'use client';

import { useEffect, useState } from 'react';

import { LinkIcon } from '@/components/content/link-icon';
import {
  parseSvgAction,
  previewLinkIconAction,
  previewTechIconAction,
  searchIconsAction,
} from '@/lib/admin/actions';
import { type IconHit, type IconSearchSource } from '@/lib/admin/icons';
import { type LinkIcon as LinkIconData, type TechIcon } from '@/lib/content';

import { SelectField, TextField } from './fields';
import { useForm } from './form';
import { LogoCombobox } from './logo-combobox';
import { hintClass, inputClass, labelClass, smallButton } from './styles';

function TechIconPreview({ icon }: { icon: TechIcon }): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label="Icon preview"
      className="inline-flex size-14 items-center justify-center rounded-lg border border-line bg-surface-1 text-text-1"
    >
      {'monogram' in icon ? (
        <span aria-hidden="true" className="font-mono text-lg">
          {icon.monogram}
        </span>
      ) : (
        <svg viewBox={icon.viewBox} aria-hidden="true" fill="currentColor" className="size-8">
          {icon.paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      )}
    </span>
  );
}

/**
 * Debounced server-side search; `onPick` receives the chosen slug.
 */
function IconSearch({
  source,
  query,
  onPick,
}: {
  onPick: (slug: string) => void;
  query: string;
  source: IconSearchSource;
}): null | React.JSX.Element {
  const [hits, setHits] = useState<IconHit[]>([]);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(async () => {
      const result = query.trim() ? await searchIconsAction(source, query).catch(() => []) : [];

      if (live) setHits(result);
    }, 220);

    return (): void => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [source, query]);

  if (hits.length === 0 || hits.some((hit) => hit.slug === query.trim())) return null;

  return (
    <ul aria-label="Matching icons" className="flex flex-wrap gap-2">
      {hits.map((hit) => (
        <li key={hit.slug}>
          <button type="button" onClick={() => onPick(hit.slug)} className={smallButton}>
            {hit.slug}
          </button>
        </li>
      ))}
    </ul>
  );
}

const SOURCES = [
  { value: 'simple-icons', label: 'Simple Icons (brands)' },
  { value: 'devicon', label: 'Devicon (developer tools)' },
  { value: 'custom-svg', label: 'Custom SVG' },
  { value: 'monogram', label: 'Monogram (letters)' },
];

/**
 * Icon source, search, custom SVG and a live preview for a technology.
 */
export function TechIconFields(): React.JSX.Element {
  const form = useForm();
  const source = String(form.get('iconSource') ?? 'monogram');
  const slug = String(form.get('iconSlug') ?? '');
  const customSvg = form.get('customSvg') as { paths: string[]; viewBox: string } | undefined;
  const monogram = String(form.get('monogram') ?? '');
  const name = String(form.get('name') ?? '');
  const [preview, setPreview] = useState<{
    brandColor?: string;
    icon: TechIcon;
  } | null>(null);
  const [svgText, setSvgText] = useState('');
  const [svgError, setSvgError] = useState('');

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(async () => {
      const result = await previewTechIconAction({
        name,
        iconSource: source as 'monogram',
        ...(slug ? { iconSlug: slug } : {}),
        ...(customSvg ? { customSvg } : {}),
        ...(monogram ? { monogram } : {}),
      }).catch(() => null);

      if (live) setPreview(result);
    }, 250);

    return (): void => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [source, slug, customSvg, monogram, name]);

  async function applySvg(text: string): Promise<void> {
    const result = await parseSvgAction(text);

    if (result.ok) {
      form.set('customSvg', result.svg);
      setSvgError('');
    } else {
      setSvgError(result.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <LogoCombobox />
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-60 flex-1">
          <SelectField path="iconSource" label="Icon source" options={SOURCES} />
        </div>
        {preview ? <TechIconPreview icon={preview.icon} /> : null}
      </div>

      {source === 'simple-icons' || source === 'devicon' ? (
        <>
          <TextField
            path="iconSlug"
            label="Icon name"
            mono
            hint="Type to search; pick a match below."
          />
          <IconSearch source={source} query={slug} onPick={(pick) => form.set('iconSlug', pick)} />
          {preview?.brandColor ? (
            <div>
              <button
                type="button"
                onClick={() => form.set('brandColor', preview.brandColor)}
                className={smallButton}
              >
                Use brand color {preview.brandColor}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {source === 'custom-svg' ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="svg-source" className={labelClass}>
            Paste SVG markup, or choose a file
          </label>
          <textarea
            id="svg-source"
            rows={5}
            value={svgText}
            disabled={form.disabled}
            onChange={(event) => setSvgText(event.target.value)}
            className={`${inputClass} font-mono text-small`}
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={form.disabled || !svgText.trim()}
              onClick={() => {
                applySvg(svgText);
              }}
              className={smallButton}
            >
              Use this SVG
            </button>
            <label className={`${smallButton} cursor-pointer`}>
              Choose .svg file
              <input
                type="file"
                accept=".svg,image/svg+xml"
                disabled={form.disabled}
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';

                  if (file) {
                    const text = await file.text();

                    setSvgText(text);
                    await applySvg(text);
                  }
                }}
              />
            </label>
          </div>
          <p className={hintClass}>
            Only filled paths and basic shapes are kept (max 20 KB). Scripts, styles, strokes and
            transforms are not supported.
          </p>
          {svgError ? (
            <p role="alert" className="text-small text-danger">
              {svgError}
            </p>
          ) : null}
          {form.error('customSvg') ? (
            <p role="alert" className="text-small text-danger">
              {form.error('customSvg')}
            </p>
          ) : null}
        </div>
      ) : null}

      {source === 'monogram' ? (
        <TextField
          path="monogram"
          label="Monogram"
          mono
          maxLength={3}
          hint="1–3 capital letters or digits. Leave empty to generate it from the name."
        />
      ) : null}
    </div>
  );
}

const LINK_MODES = [
  { value: 'link', label: 'Generic link' },
  { value: 'simple-icons', label: 'Brand (Simple Icons)' },
  { value: 'lucide', label: 'Lucide icon' },
];

/**
 * `link`, `simple-icons:<slug>` or `lucide:<name>`, with search and preview.
 */
export function LinkIconField({ path }: { path: string }): React.JSX.Element {
  const form = useForm();
  const value = String(form.get(path) ?? 'link');
  const mode = value === 'link' ? 'link' : (value.split(':')[0] ?? 'link');
  const name = value.includes(':') ? value.slice(value.indexOf(':') + 1) : '';
  const [preview, setPreview] = useState<LinkIconData | null>(null);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(async () => {
      const result = await previewLinkIconAction(value).catch(() => null);

      if (live) setPreview(result);
    }, 250);

    return (): void => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-60 flex-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="link-icon-mode" className={labelClass}>
              Icon
            </label>
            <select
              id="link-icon-mode"
              value={mode}
              disabled={form.disabled}
              onChange={(event) =>
                form.set(path, event.target.value === 'link' ? 'link' : `${event.target.value}:`)
              }
              className={inputClass}
            >
              {LINK_MODES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {preview ? (
          <span
            role="img"
            aria-label="Icon preview"
            className="inline-flex size-14 items-center justify-center rounded-lg border border-line bg-surface-1 text-text-1"
          >
            <LinkIcon icon={preview} className="size-7" />
          </span>
        ) : null}
      </div>
      {mode !== 'link' ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${path}-name`} className={labelClass}>
              {mode === 'lucide' ? 'Lucide icon name' : 'Brand name'}
            </label>
            <input
              id={`${path}-name`}
              value={name}
              disabled={form.disabled}
              autoComplete="off"
              onChange={(event) => form.set(path, `${mode}:${event.target.value}`)}
              className={`${inputClass} font-mono`}
            />
            {form.error(path) ? <p className="text-small text-danger">{form.error(path)}</p> : null}
          </div>
          <IconSearch
            source={mode as IconSearchSource}
            query={name}
            onPick={(pick) => form.set(path, `${mode}:${pick}`)}
          />
        </>
      ) : null}
    </div>
  );
}
