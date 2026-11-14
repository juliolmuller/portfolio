'use client';

import Image from 'next/image';
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';

import { fieldId } from '@/lib/admin/path';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast-store';

import { LocalizedField } from './fields';
import { SESSION_EXPIRED, useForm } from './form';
import { hintClass, labelClass, smallButton } from './styles';

async function upload(file: File, kind: 'image' | 'pdf'): Promise<Record<string, unknown>> {
  const body = new FormData();

  body.set('file', file);
  body.set('kind', kind);

  const response = await fetch('/admin/api/upload', { method: 'POST', body });
  const data = (await response.json().catch(() => ({}))) as {
    asset?: Record<string, unknown>;
    error?: string;
  };

  // Only the route answers with JSON; a bare 400/404/405 is the proxy's 404
  // page, i.e. no session.
  if (!data.error && [400, 404, 405].includes(response.status)) {
    throw new Error(SESSION_EXPIRED);
  }

  if (!response.ok || !data.asset) {
    throw new Error(data.error ?? 'Upload failed');
  }

  return data.asset;
}

/**
 * Click-or-drop target shared by the image and PDF fields.
 */
function DropZone({
  id,
  accept,
  busy,
  label,
  onFile,
}: {
  accept: string;
  busy: boolean;
  id: string;
  label: string;
  onFile: (file: File) => void;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const form = useForm();
  const [over, setOver] = useState(false);

  return (
    // Dropping is a pointer extra; the button inside is the keyboard path.
    // eslint-disable-next-line jsx-a11y-x/no-static-element-interactions
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);

        const file = event.dataTransfer.files[0];

        if (file && !form.disabled) onFile(file);
      }}
      className={cn(
        'flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center',
        over ? 'border-accent-1 bg-surface-2' : 'border-line-strong',
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        aria-label={label}
        disabled={form.disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';

          if (file) onFile(file);
        }}
        className="sr-only"
      />
      <button
        type="button"
        disabled={form.disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={smallButton}
      >
        {busy ? 'Uploading…' : label}
      </button>
      <p className={hintClass}>or drop a file here</p>
    </div>
  );
}

interface ImageValue {
  asset?: { height: number; url: string; width: number };
  focal?: { x: number; y: number };
}

/**
 * Upload, preview, focal point and bilingual alt text for one image.
 */
export function ImageField({
  path,
  label,
  alt = true,
}: {
  /**
   * Avatars derive their alt text from the person's name.
   */
  alt?: boolean;
  label: string;
  path: string;
}): React.JSX.Element {
  const form = useForm();
  const value = form.get(path) as ImageValue | undefined;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const asset = value?.asset;
  const focal = value?.focal ?? { x: 0.5, y: 0.5 };
  const id = fieldId(path);
  const error = form.error(`${path}.asset`) ?? form.error(path);

  async function onFile(file: File): Promise<void> {
    setBusy(true);
    setMessage('');

    try {
      form.set(`${path}.asset`, await upload(file, 'image'));
      toast('Image uploaded. Save to publish it.', 'success');
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  function setFocal(x: number, y: number): void {
    const clamp = (n: number): number => Math.min(1, Math.max(0, Math.round(n * 100) / 100));

    form.set(`${path}.focal`, { x: clamp(x), y: clamp(y) });
  }

  function onPick(event: PointerEvent<HTMLDivElement>): void {
    const box = event.currentTarget.getBoundingClientRect();

    setFocal((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>): void {
    const step = event.shiftKey ? 0.1 : 0.02;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];

    if (!move) return;

    event.preventDefault();
    setFocal(focal.x + move[0], focal.y + move[1]);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={labelClass}>{label}</legend>
      {asset ? (
        <div className="flex flex-col gap-2">
          <div
            onPointerDown={onPick}
            className="relative w-full max-w-md cursor-crosshair overflow-hidden rounded-lg border border-line"
          >
            <Image
              src={asset.url}
              width={asset.width}
              height={asset.height}
              alt=""
              sizes="448px"
              draggable={false}
              className="h-auto w-full select-none"
            />
            <button
              type="button"
              aria-label="Focal point. Arrow keys move it."
              disabled={form.disabled}
              onKeyDown={onKey}
              onPointerDown={(event) => event.stopPropagation()}
              style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
              className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent-1/70 shadow-md"
            />
          </div>
          <p className={hintClass}>
            {asset.width}×{asset.height}. Click the image to set the focal point (
            {Math.round(focal.x * 100)}%, {Math.round(focal.y * 100)}%); it stays visible when the
            image is cropped.
          </p>
          <div>
            <button
              type="button"
              disabled={form.disabled}
              onClick={() => form.set(path, undefined)}
              className={smallButton}
            >
              Remove image
            </button>
          </div>
        </div>
      ) : null}
      <DropZone
        id={id}
        accept="image/jpeg,image/png,image/webp,image/avif"
        busy={busy}
        label={asset ? 'Replace image' : 'Choose image'}
        onFile={(file) => {
          onFile(file);
        }}
      />
      {message || error ? (
        <p role="alert" className="text-small text-danger">
          {message || error}
        </p>
      ) : null}
      {alt && asset ? (
        <LocalizedField
          path={`${path}.alt`}
          label="Alt text"
          max={200}
          hint="Describe the image for people who cannot see it."
        />
      ) : null}
    </fieldset>
  );
}

interface PdfValue {
  size: number;
  url: string;
}

/**
 * A PDF per language (the resume).
 */
export function PdfField({ path, label }: { label: string; path: string }): React.JSX.Element {
  const form = useForm();
  const value = form.get(path) as PdfValue | undefined;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function onFile(file: File): Promise<void> {
    setBusy(true);
    setMessage('');

    try {
      form.set(path, await upload(file, 'pdf'));
      toast('PDF uploaded. Save to publish it.', 'success');
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={labelClass}>{label}</legend>
      {value ? (
        <p className="text-small">
          <a href={value.url} target="_blank" rel="noopener noreferrer" className="underline">
            Current file (opens in a new tab)
          </a>{' '}
          <span className="text-text-3">· {(value.size / 1024).toFixed(0)} KB</span>
        </p>
      ) : (
        <p className="text-small text-text-3">No file yet.</p>
      )}
      <DropZone
        id={fieldId(path)}
        accept="application/pdf"
        busy={busy}
        label={value ? 'Replace PDF' : 'Choose PDF'}
        onFile={(file) => {
          onFile(file);
        }}
      />
      {value ? (
        <div>
          <button
            type="button"
            disabled={form.disabled}
            onClick={() => form.set(path, undefined)}
            className={smallButton}
          >
            Remove PDF
          </button>
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="text-small text-danger">
          {message}
        </p>
      ) : null}
    </fieldset>
  );
}
