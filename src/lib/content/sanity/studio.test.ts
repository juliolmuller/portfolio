import {
  fieldValidator,
  singletonTypes,
  type StudioRule,
  studioSchemaTypes,
  UNVALIDATED_FIELDS,
} from '../../../../sanity/studio';
import { createFixtureDataset } from '../fixtures/dataset';
import { type DocumentType, documentTypes } from '../schema';
import { toSanityDocuments } from './documents';

interface StudioField {
  name: string;
  type: string;
  validation?: (rule: StudioRule) => StudioRule;
}

interface StudioType {
  fields: StudioField[];
  name: string;
  orderings?: unknown[];
  preview?: {
    prepare: (values: Record<string, unknown>) => Record<string, unknown>;
    select: Record<string, string>;
  };
  type: string;
}

const types = studioSchemaTypes as unknown as StudioType[];
const byName = new Map(types.map((type) => [type.name, type]));

/**
 * Runs a field's Studio validation the way Studio would.
 */
function validate(type: DocumentType, name: string, value: unknown): string | true {
  const field = byName.get(type)?.fields.find((item) => item.name === name);

  if (!field?.validation) throw new Error(`${type}.${name} has no validation`);

  const results: Array<string | true> = [];
  let required = false;
  const rule: StudioRule = {
    required() {
      required = true;

      return rule;
    },
    custom(validator) {
      results.push(validator(value));

      return rule;
    },
  };

  field.validation(rule);

  if (required && (value === undefined || value === null || value === '')) {
    results.push('Required');
  }

  return results.find((result) => result !== true) ?? true;
}

const documents = toSanityDocuments(createFixtureDataset(), {
  image: () => 'image-asset',
  file: () => 'file-asset',
});

describe('sanity/studio.ts', () => {
  it('accepts every seeded document, field by field', () => {
    const errors: string[] = [];
    for (const document of documents) {
      const type = document._type as DocumentType;
      for (const field of byName.get(type)?.fields ?? []) {
        if (!field.validation) continue;

        const value = (document as Record<string, unknown>)[field.name];
        const result = validate(type, field.name, value);

        if (result !== true) errors.push(`${document._id}.${field.name}: ${result}`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('validates every field the zod contract knows', () => {
    const missing: string[] = [];
    for (const type of documentTypes) {
      for (const field of byName.get(type)?.fields ?? []) {
        const skipped = UNVALIDATED_FIELDS[type]?.includes(field.name);

        if (!field.validation && !skipped) missing.push(`${type}.${field.name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('mirrors zod limits, patterns and both-language rules', () => {
    const title = { _type: 'localeString', en: 'Orbit', pt: 'Órbita' };

    expect(validate('project', 'title', title)).toBe(true);
    expect(validate('project', 'title', { ...title, pt: '' })).toMatch(/pt/);
    expect(validate('project', 'title', { ...title, en: 'x'.repeat(81) })).toMatch(/en/);
    expect(validate('project', 'title', undefined)).toBe('Required');
    expect(validate('project', 'outcome', undefined)).toBe(true);
    expect(validate('project', 'slug', { current: 'orbit-dashboard' })).toBe(true);
    expect(validate('project', 'slug', { current: 'Orbit Dashboard' })).not.toBe(true);
    expect(validate('featuredLink', 'url', 'http://example.com')).not.toBe(true);
    expect(validate('featuredLink', 'url', 'mailto:hello@example.com')).toBe(true);
    expect(validate('technology', 'brandColor', 'red')).not.toBe(true);
    expect(validate('technology', 'brandColor', '#ff0000')).toBe(true);
    expect(validate('contact', 'phone', '41 9999-9999')).not.toBe(true);
    expect(validate('experience', 'roles', [])).not.toBe(true);
    expect(validate('project', 'body', { en: 'Fine', pt: '<script>x</script>' })).toMatch(/HTML/);
  });

  it('validates skills field by field', () => {
    const name = { _type: 'localeString', en: 'Clean Architecture', pt: 'Arquitetura limpa' };

    expect(validate('skill', 'name', name)).toBe(true);
    expect(validate('skill', 'name', { ...name, pt: '' })).toMatch(/pt/);
    expect(validate('skill', 'name', undefined)).toBe('Required');
    expect(validate('skill', 'categories', ['frontend', 'engineering'])).toBe(true);
    expect(validate('skill', 'categories', [])).not.toBe(true);
    expect(validate('skill', 'categories', ['data', 'data'])).toMatch(/Duplicate/);
    expect(validate('skill', 'categories', ['skills'])).not.toBe(true);
    expect(validate('skill', 'brandColor', 'red')).not.toBe(true);
    expect(validate('skill', 'brandColor', '#ff0000')).toBe(true);
    expect(validate('skill', 'priority', 4)).not.toBe(true);
    expect(validate('skill', 'priority', undefined)).toBe(true);
    expect(validate('skill', 'showInCloud', undefined)).toBe(true);
    expect(validate('skill', 'iconSource', undefined)).toBe(true);
    expect(byName.get('skill')?.preview?.select).toEqual({
      title: 'name.en',
      subtitle: 'categories.0',
      visible: 'visible',
    });
  });

  it('requires an asset and alt text in both languages on images', () => {
    const alt = { en: 'A cover', pt: 'Uma capa' };
    const asset = { _type: 'reference', _ref: 'image-asset' };

    expect(validate('project', 'cover', undefined)).toBe(true);
    expect(validate('project', 'cover', { asset, alt })).toBe(true);
    expect(validate('project', 'cover', { asset, alt: { en: 'A cover' } })).toMatch(/pt/);
    expect(validate('project', 'cover', { alt })).toMatch(/image/);
    expect(validate('project', 'gallery', [{ asset, alt: { en: 'x' } }])).toMatch(/^1\.alt/);
    expect(validate('recommendedProfile', 'avatar', { asset })).toBe(true);
  });

  it('gives every document a preview and every collection an ordering', () => {
    for (const type of documentTypes) {
      const studioType = byName.get(type);

      expect(studioType?.preview?.select['title'], type).toBeTruthy();

      const ordered = studioType?.fields.some((field) => field.name === 'order');

      expect(Boolean(studioType?.orderings), type).toBe(Boolean(ordered));
    }
    const project = byName.get('project')?.preview;

    expect(
      project?.prepare({
        title: 'Scratch',
        subtitle: 'scratch-pad',
        visible: false,
      }),
    ).toMatchObject({ title: 'Scratch', subtitle: 'scratch-pad · hidden' });
    expect(singletonTypes).toEqual(['profile', 'contact', 'resume']);
  });

  it('keeps the deployable schema plain data', () => {
    const json = JSON.stringify(studioSchemaTypes, (_key, value: unknown) =>
      typeof value === 'function' ? undefined : value,
    );

    expect(json).toContain('"name":"project"');
    expect(fieldValidator('project', { name: 'technologies', type: 'array' })).toBeNull();
  });
});
