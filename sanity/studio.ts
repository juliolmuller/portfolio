/**
 * Studio layer over `sanity/schema.ts` (§11.10, D65): previews, orderings and
 * field validation that mirror the app's zod contract, for a separately run
 * Sanity Studio. Nothing here is imported by the app, and it needs no `sanity`
 * dependency: `StudioRule` is the small structural slice of Sanity's `Rule` it
 * uses (`required()` and `custom()`), which the real type satisfies. The
 * deployable schema stays plain data in `schema.ts`; this file adds the
 * functions a Studio can run but the schema API cannot store.
 *
 * Import { studioSchemaTypes, singletonTypes } from '<repo>/sanity/studio';
 * defineConfig({ …, schema: { types: studioSchemaTypes } });
 *
 * Validators read the zod schemas in `src/lib/content/schema.ts` directly, so
 * limits, patterns and both-languages rules cannot drift. Cross-field and
 * cross-document rules (slug uniqueness, existing technologies, icon source
 * requirements) stay with the admin service and the read pipeline, which skips
 * and logs an invalid document instead of publishing it.
 */
import { type z } from 'zod';

import { documentSchemas, type DocumentType, galleryItemSchema } from '../src/lib/content/schema';
import { schemaTypes } from './schema';

export interface StudioRule {
  custom(validator: (value: unknown) => string | true): StudioRule;
  required(): StudioRule;
}

export type StudioValidator = (value: unknown) => string | true;

type Field = (typeof schemaTypes)[number]['fields'][number];

/**
 * Fixed-id documents: open them directly, never "create new".
 */
export const singletonTypes = ['profile', 'contact', 'resume'] as const;

/**
 * Storage fields that have no field-level twin in the zod contract:
 * `technologies` are references (zod checks `techIds` exist), and resume files
 * are assets that the read path resolves to URLs.
 */
export const UNVALIDATED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  project: ['technologies'],
  experience: ['technologies'],
  resume: ['file'],
};

function message(error: z.ZodError): string {
  const issue = error.issues[0];

  if (!issue) return 'Invalid value';

  const path = issue.path.map(String).join('.');

  return path ? `${path}: ${issue.message}` : issue.message;
}

function check(schema: z.ZodType, value: unknown): string | true {
  const result = schema.safeParse(value);

  return result.success ? true : message(result.error);
}

function isRequired(schema: z.ZodType): boolean {
  return !schema.safeParse(undefined).success;
}

type ObjectSchema = { shape: Record<string, z.ZodType> } & z.ZodType;

function hasShape(schema: z.ZodType): schema is ObjectSchema {
  return 'shape' in schema && typeof schema.shape === 'object';
}

/**
 * The object behind `.optional()` / `.default()`, when there is one.
 */
function unwrapObject(schema: z.ZodType): null | ObjectSchema {
  let current: z.ZodType = schema;
  for (let depth = 0; depth < 4; depth += 1) {
    if (hasShape(current)) return current;

    const inner = (current as { unwrap?: () => z.ZodType }).unwrap;

    if (typeof inner !== 'function') return null;

    current = inner.call(current);
  }

  return null;
}

/**
 * An image in storage: `{ asset: { _ref }, alt?, hotspot? }`.
 */
function imageValidator(schema: z.ZodType): StudioValidator {
  const shape = unwrapObject(schema)?.shape;
  const alt = shape?.['alt'];

  return (value) => {
    if (value === undefined || value === null) return true;

    const image = value as { alt?: unknown; asset?: unknown };

    if (!image.asset) return 'Upload an image or remove the field';

    return alt ? check(alt, image.alt) : true;
  };
}

/**
 * Gallery items: an uploaded image with alt text and an optional caption.
 */
function galleryValidator(): StudioValidator {
  const { alt, caption } = galleryItemSchema.shape;

  return (value) => {
    if (value === undefined || value === null) return true;

    if (!Array.isArray(value)) return 'Expected a list of images';

    for (const [index, item] of value.entries()) {
      const entry = item as {
        alt?: unknown;
        asset?: unknown;
        caption?: unknown;
      };

      if (!entry.asset) return `${index + 1}: upload an image`;

      const altResult = check(alt, entry.alt);

      if (altResult !== true) return `${index + 1}.alt: ${altResult}`;

      const captionResult = check(caption, entry.caption);

      if (captionResult !== true) return `${index + 1}.caption: ${captionResult}`;
    }

    return true;
  };
}

/**
 * The validator for one stored field, or null when the contract has no
 * field-level twin (see `UNVALIDATED_FIELDS`). Empty values pass here; a
 * required field is marked with `required()` instead, so Studio shows one clear
 * message.
 */
export function fieldValidator(
  type: DocumentType,
  field: Field,
): { required: boolean; validate: StudioValidator } | null {
  if (UNVALIDATED_FIELDS[type]?.includes(field.name)) return null;

  const shape = unwrapObject(documentSchemas[type])?.shape;
  const schema = shape?.[field.name];

  if (!schema) return null;

  const required = isRequired(schema);
  const optional =
    (validate: StudioValidator): StudioValidator =>
    (value) =>
      value === undefined || value === null || value === '' ? true : validate(value);

  if (field.type === 'image') {
    return { validate: imageValidator(schema), required };
  }

  if (field.name === 'gallery') {
    return { validate: galleryValidator(), required };
  }

  if (field.type === 'slug') {
    return {
      validate: optional((value) => check(schema, (value as { current?: unknown }).current)),
      required,
    };
  }

  return { validate: optional((value) => check(schema, value)), required };
}

const PREVIEWS: Record<DocumentType, { media?: string; subtitle?: string; title: string }> = {
  profile: { title: 'displayName', subtitle: 'jobTitle.en', media: 'photo' },
  contact: { title: 'email', subtitle: 'ctaHeading.en' },
  resume: { title: 'file.en.asset.originalFilename' },
  featuredLink: { title: 'label.en', subtitle: 'url' },
  recommendedProfile: { title: 'name', subtitle: 'role.en', media: 'avatar' },
  project: { title: 'title.en', subtitle: 'slug.current', media: 'cover' },
  experience: { title: 'company', subtitle: 'roles.0.title.en' },
  education: { title: 'title.en', subtitle: 'institution' },
  technology: { title: 'name', subtitle: 'category' },
  practice: { title: 'label.en' },
};

interface PreviewValues {
  media?: unknown;
  subtitle?: string;
  title?: string;
  visible?: boolean;
}

/**
 * List rows show the English title and flag hidden documents.
 */
function preview(type: DocumentType): {
  prepare: ({ title, subtitle, media, visible }: PreviewValues) => {
    media: unknown;
    subtitle: string;
    title: string;
  };
  select: { media?: string; subtitle?: string; title: string; visible: string };
} {
  const select = { ...PREVIEWS[type], visible: 'visible' };

  return {
    select,
    prepare: ({ title, subtitle, media, visible }: PreviewValues) => ({
      title: title || (type === 'resume' ? 'Resume' : 'Untitled'),
      subtitle: [subtitle, visible === false ? 'hidden' : null].filter(Boolean).join(' · '),
      media,
    }),
  };
}

const ORDER_ASC = {
  title: 'Display order',
  name: 'orderAsc',
  by: [{ field: 'order', direction: 'asc' }],
};

function isDocumentType(name: string): name is DocumentType {
  return name in documentSchemas;
}

/**
 * `schemaTypes` plus previews, orderings and zod-backed validation.
 */
export const studioSchemaTypes = schemaTypes.map((type) => {
  if (type.type !== 'document' || !isDocumentType(type.name)) return type;

  const name = type.name;
  const ordered = type.fields.some((field) => field.name === 'order');

  return {
    ...type,
    preview: preview(name),
    ...(ordered ? { orderings: [ORDER_ASC] } : {}),
    fields: type.fields.map((field) => {
      const validator = fieldValidator(name, field);

      if (!validator) return field;

      return {
        ...field,
        validation: (rule: StudioRule): StudioRule => {
          const checked = rule.custom(validator.validate);

          return validator.required ? checked.required() : checked;
        },
      };
    }),
  };
});
