import { type AppLocale, localeTags } from '@/i18n/routing';

/**
 * `2023-03` → "Mar 2023" / "mar. de 2023"; `2016` → "2016".
 */
export function formatPartialDate(locale: AppLocale, value: string): string {
  const [year, month] = value.split('-').map(Number);

  if (!year) return value;

  if (!month) return String(year);

  return new Intl.DateTimeFormat(localeTags[locale], {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month - 1, 1));
}

export function formatDate(locale: AppLocale, iso: string): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function formatList(locale: AppLocale, items: readonly string[]): string {
  return new Intl.ListFormat(localeTags[locale], {
    style: 'long',
    type: 'conjunction',
  }).format(items);
}

/**
 * Plain text split into paragraphs at blank lines; single line breaks stay
 * inside a paragraph.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .replaceAll(/\r\n?/g, '\n')
    .split(/\n[^\S\n]*\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}
