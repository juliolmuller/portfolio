'use client';

import { useId, useState } from 'react';

import { type SvgData } from '@/lib/content/schema';

import { useForm } from './form';
import { hintClass, inputClass, labelClass, smallButton } from './styles';
import { type CatalogHit, useLogoSearch } from './use-logo-search';

function Thumb({ svg }: { svg: SvgData }): React.JSX.Element {
  return (
    <svg viewBox={svg.viewBox} aria-hidden="true" fill="currentColor" className="size-7 shrink-0">
      {svg.paths.map((d, index) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- paths are static data and may repeat
        <path key={`${index}-${d}`} d={d} />
      ))}
    </svg>
  );
}

// Mirrors `iconSlug` in technologySchema.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 64;

type Option =
  | { hit: CatalogHit; id: string; kind: 'catalog' }
  | { host: string; id: string; kind: 'online'; label: string; svg: SvgData; variant: string }
  | { id: string; kind: 'url' };

const optionClass =
  'flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-small text-text-1 aria-selected:bg-surface-2';

/**
 * "Find a logo": bundled-catalog matches plus AI-suggested, pre-validated SVGs.
 * Never required; the controls below it keep working on their own.
 */
export function LogoCombobox(): React.JSX.Element {
  const form = useForm();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const { catalog, online, status, search } = useLogoSearch();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const options: Option[] = [
    ...catalog.map((hit): Option => ({
      kind: 'catalog',
      id: `${baseId}-c-${hit.source}-${hit.slug}`,
      hit,
    })),
    ...online.map((item): Option => ({ ...item, kind: 'online', id: `${baseId}-o-${item.id}` })),
    { kind: 'url', id: `${baseId}-url` },
  ];
  const current = options[Math.min(active, options.length - 1)];
  const expanded = open && value.trim().length >= 2;

  const message =
    status === 'searching'
      ? 'Searching…'
      : status === 'unavailable'
        ? 'Online search is unavailable right now. Paste an SVG URL or file below.'
        : status === 'idle'
          ? ''
          : `${catalog.length + online.length} logos found`;

  function pick(option: Option): void {
    if (option.kind === 'url') {
      setUrlMode(true);
      setOpen(false);
      requestAnimationFrame(() => document.getElementById(`${baseId}-url-input`)?.focus());
    } else if (option.kind === 'catalog') {
      form.set('iconSource', option.hit.source);
      form.set('iconSlug', option.hit.slug);
      setOpen(false);
    } else {
      applySvg(option.svg);
      setOpen(false);
    }
  }

  /**
   * An inactive but malformed slug would still fail validation on save; valid
   * ones stay.
   */
  function applySvg(svg: SvgData): void {
    form.set('iconSource', 'custom-svg');
    form.set('customSvg', svg);

    const slug = String(form.get('iconSlug') ?? '');

    if (slug.length > MAX_SLUG || !SLUG.test(slug)) form.set('iconSlug', '');
  }

  async function importUrl(): Promise<void> {
    setUrlError('');

    try {
      const response = await fetch('/admin/api/logo-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { error?: string; svg?: SvgData };

      if (!response.ok || !data.svg) {
        setUrlError(data.error ?? 'That logo could not be imported');

        return;
      }

      applySvg(data.svg);
      setUrlMode(false);
      setUrl('');
    } catch {
      setUrlError('That logo could not be imported');
    }
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    const last = options.length - 1;

    if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, last));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home' && expanded) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End' && expanded) {
      event.preventDefault();
      setActive(last);
    } else if (event.key === 'Enter') {
      // The input sits inside the editor form: Enter must never submit it.
      event.preventDefault();

      if (expanded && current) pick(current);
    }
  }

  const groups: Array<{ items: Option[]; label: string }> = [
    { label: 'Bundled catalogs', items: options.filter((o) => o.kind === 'catalog') },
    { label: 'Found online', items: options.filter((o) => o.kind === 'online') },
    { label: 'Other', items: options.filter((o) => o.kind === 'url') },
  ];

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${baseId}-input`} className={labelClass}>
        Find a logo
      </label>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <input
            id={`${baseId}-input`}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded ? current?.id : undefined}
            autoComplete="off"
            value={value}
            disabled={form.disabled}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
              setActive(0);
              search(event.target.value);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
            className={inputClass}
          />
          <div
            id={listId}
            role="listbox"
            aria-label="Logo suggestions"
            hidden={!expanded}
            className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-md border border-line-strong bg-surface-1 shadow-lg"
          >
            {groups.map((group) =>
              group.items.length === 0 ? null : (
                <div key={group.label} role="group" aria-label={group.label}>
                  <p aria-hidden="true" className="px-3 pt-2 text-xs text-text-3">
                    {group.label}
                  </p>
                  {group.items.map((option) => (
                    <div
                      key={option.id}
                      id={option.id}
                      role="option"
                      tabIndex={-1}
                      aria-selected={option.id === current?.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(option)}
                      onKeyDown={() => {}}
                      className={optionClass}
                    >
                      {option.kind === 'online' ? (
                        <>
                          <Thumb svg={option.svg} />
                          <span className="flex-1">
                            {option.label}
                            <span className="block text-xs text-text-3">
                              {option.host} · {option.variant}
                            </span>
                          </span>
                        </>
                      ) : option.kind === 'catalog' ? (
                        <span>
                          {option.hit.label}
                          <span className="block text-xs text-text-3">{option.hit.source}</span>
                        </span>
                      ) : (
                        <span>Use a URL instead…</span>
                      )}
                    </div>
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={form.disabled || !String(form.get('name') ?? '').trim()}
          onClick={() => {
            const name = String(form.get('name') ?? '');

            setValue(name);
            setOpen(true);
            search(name);
          }}
          className={smallButton}
        >
          Use technology name
        </button>
      </div>
      <p role="status" aria-live="polite" className={hintClass}>
        {message}
      </p>
      {urlMode ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${baseId}-url-input`} className={labelClass}>
            SVG URL
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`${baseId}-url-input`}
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={`${inputClass} min-w-60 flex-1 font-mono`}
              spellCheck={false}
            />
            <button
              type="button"
              disabled={form.disabled || !url.trim()}
              onClick={() => {
                importUrl();
              }}
              className={smallButton}
            >
              Import
            </button>
          </div>
          {urlError ? (
            <p role="alert" className="text-small text-danger">
              {urlError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
