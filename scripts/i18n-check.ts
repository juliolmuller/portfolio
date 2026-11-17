/**
 * Localization gate (§6, §17). Fails on: different key sets between message
 * catalogs, empty values, mismatched ICU arguments, and any fixture localized
 * field missing a language. Reports (without failing) values identical in both
 * languages that are not known proper nouns.
 *
 * Bun run i18n:check.
 */
import { type MessageFormatElement, parse, TYPE } from '@formatjs/icu-messageformat-parser';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createFixtureDataset } from '@/lib/content/fixtures/dataset';
import { documentTypes } from '@/lib/content/schema';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCALES = ['en', 'pt'] as const;

/**
 * Identical in both languages on purpose.
 */
const SAME_MESSAGE_KEYS = new Set([
  'errors.notFoundPrompt',
  'header.languageNames.en',
  'header.languageNames.pt',
  'header.languageShort.en',
  'header.languageShort.pt',
  'header.menuTitle',
  'header.nav.stack',
  'meta.homeTitle',
  'projects.filters.desktop',
  'projects.filters.mobile',
  'projects.filters.open-source',
  'projects.filters.web',
  'stack.categories.frontend',
  'stack.eyebrow',
  'work.kinds.desktop',
  'work.kinds.mobile',
  'work.kinds.open-source',
  'work.kinds.web',
]);

const PROPER_NOUNS = new Set([
  'APIs',
  'CI/CD',
  'Clean Architecture',
  'Design systems',
  'Developer Advocate',
  'GitHub',
  'LinkedIn',
  'Microfrontends',
  'Product Designer',
  'SOLID',
  'Staff Engineer',
]);

interface Messages {
  [key: string]: Messages | string;
}

const errors: string[] = [];
const notices: string[] = [];

function flatten(messages: Messages, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const name = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') out.set(name, value);
    else for (const entry of flatten(value, name)) out.set(...entry);
  }

  return out;
}

function argumentsOf(elements: MessageFormatElement[], out = new Set<string>()): Set<string> {
  for (const element of elements) {
    switch (element.type) {
      case TYPE.argument:
      case TYPE.date:
      case TYPE.number:
      case TYPE.time:
        out.add(`${element.value}:${element.type}`);
        break;
      case TYPE.plural:
      case TYPE.select:
        out.add(`${element.value}:${element.type}`);
        for (const option of Object.values(element.options)) {
          argumentsOf(option.value, out);
        }
        break;
      case TYPE.tag:
        out.add(`<${element.value}>`);
        argumentsOf(element.children, out);
        break;
      default:
        break;
    }
  }

  return out;
}

function icuArguments(key: string, locale: string, message: string): null | string {
  try {
    return [...argumentsOf(parse(message))].sort().join(', ');
  } catch (error) {
    errors.push(`messages/${locale}.json ${key}: invalid ICU (${(error as Error).message})`);

    return null;
  }
}

/**
 * Placeholders and punctuation only, e.g. "{jobTitle} · {city}".
 */
function hasTranslatableText(message: string): boolean {
  return /\p{L}{2,}/u.test(message.replace(/\{[^}]*\}/g, ''));
}

async function checkMessages(): Promise<number | undefined> {
  const [en, pt] = await Promise.all(
    LOCALES.map(async (locale) =>
      flatten(
        JSON.parse(
          await readFile(path.join(ROOT, 'messages', `${locale}.json`), 'utf8'),
        ) as Messages,
      ),
    ),
  );

  if (!en || !pt) return;

  for (const [locale, own, other] of [
    ['en', en, pt],
    ['pt', pt, en],
  ] as const) {
    for (const key of own.keys()) {
      if (!other.has(key)) {
        errors.push(`${key}: missing in messages/${locale === 'en' ? 'pt' : 'en'}.json`);
      }
    }
  }

  for (const [key, enValue] of en) {
    const ptValue = pt.get(key);

    if (ptValue === undefined) continue;

    for (const [locale, value] of [
      ['en', enValue],
      ['pt', ptValue],
    ] as const) {
      if (!value.trim()) errors.push(`messages/${locale}.json ${key}: empty`);
    }
    const enArgs = icuArguments(key, 'en', enValue);
    const ptArgs = icuArguments(key, 'pt', ptValue);

    if (enArgs !== null && ptArgs !== null && enArgs !== ptArgs) {
      errors.push(`${key}: ICU arguments differ (en: ${enArgs}; pt: ${ptArgs})`);
    }

    if (enValue === ptValue && hasTranslatableText(enValue) && !SAME_MESSAGE_KEYS.has(key)) {
      notices.push(`messages ${key}: identical in en and pt ("${enValue}")`);
    }
  }

  return en.size;
}

function isLocalized(value: unknown): value is { en?: unknown; pt?: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const entries = Object.entries(value);

  return (
    entries.some(([key]) => key === 'en')
    && entries.every(
      ([key, entry]) =>
        (key === 'en' || key === 'pt') && (entry === undefined || typeof entry === 'string'),
    )
  );
}

function checkFixtures(): number {
  const dataset = createFixtureDataset();
  let fields = 0;

  const walk = (value: unknown, where: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${where}[${index}]`));

      return;
    }

    if (!value || typeof value !== 'object') return;

    if (isLocalized(value)) {
      fields += 1;
      for (const locale of LOCALES) {
        const text = value[locale];

        if (typeof text !== 'string' || !text.trim()) {
          errors.push(`fixture ${where}: missing ${locale}`);
        }
      }

      if (
        value.en === value.pt
        && typeof value.en === 'string'
        && hasTranslatableText(value.en)
        && !PROPER_NOUNS.has(value.en)
        && !/(?:^|\.)(?:title|name)$/.test(where)
      ) {
        notices.push(`fixture ${where}: identical in en and pt ("${value.en}")`);
      }

      return;
    }

    for (const [key, entry] of Object.entries(value)) {
      walk(entry, `${where}.${key}`);
    }
  };

  for (const type of documentTypes) {
    for (const document of dataset[type]) {
      // A localized name (skills) is an object, so label by its English text.
      const name = 'name' in document ? document.name : undefined;
      const label =
        'slug' in document
          ? document.slug
          : typeof name === 'string'
            ? name
            : (name?.en ?? document.id);

      walk(document, `${type}(${label})`);
    }
  }

  return fields;
}

const messageCount = await checkMessages();
const fieldCount = checkFixtures();

for (const notice of notices) console.warn(`! ${notice}`);
for (const error of errors) console.error(`✗ ${error}`);

if (errors.length > 0) {
  console.error(`i18n check failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.info(
  `i18n check passed: ${messageCount ?? 0} messages and ${fieldCount} localized fixture fields in en and pt${
    notices.length ? `, ${notices.length} notice(s).` : '.'
  }`,
);
