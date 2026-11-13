/**
 * Studio-ready schema (§11.10), kept as plain data so the app needs no `sanity`
 * dependency. It mirrors the storage shape written by
 * `src/lib/content/sanity/documents.ts`; validation lives in the zod schemas.
 * Deployed as an MCP-managed workspace schema; print the declaration with `bun
 * run sanity:schema`. A Studio should use `studioSchemaTypes` from
 * `./studio.ts`, which adds previews, orderings and zod-backed validation.
 */

import { titleFontLabels, titleFonts } from '../src/lib/content/taxonomy';

type Field = { name: string; type: string } & Record<string, unknown>;
type SchemaType = {
  fields: Field[];
  name: string;
  type: string;
} & Record<string, unknown>;

const list = (
  values: readonly string[],
): { layout: string; list: Array<{ title: string; value: string }> } => ({
  list: values.map((value) => ({ title: value, value })),
  layout: 'radio',
});

const field = (name: string, type: string, extra: object = {}): Field => ({
  name,
  type,
  ...extra,
});

const localeString = (name: string, title?: string): Field =>
  field(name, 'localeString', title ? { title } : {});
const localeText = (name: string, title?: string): Field =>
  field(name, 'localeText', title ? { title } : {});

const image = (name: string, extraFields: Field[] = []): Field =>
  field(name, 'image', {
    options: { hotspot: true },
    fields: [localeString('alt', 'Alternative text'), ...extraFields],
  });

const technologyRefs = field('technologies', 'array', {
  of: [{ type: 'reference', to: [{ type: 'technology' }] }],
});

const common = [
  field('order', 'number', { initialValue: 0 }),
  field('visible', 'boolean', { initialValue: true }),
  field('isFixture', 'boolean', {
    readOnly: true,
    description: 'Fictional seed data (Appendix A).',
  }),
];

const objects: SchemaType[] = [
  {
    name: 'localeString',
    title: 'Localized string',
    type: 'object',
    fields: [
      field('en', 'string', { title: 'English' }),
      field('pt', 'string', { title: 'Português (Brasil)' }),
    ],
  },
  {
    name: 'localeText',
    title: 'Localized text',
    type: 'object',
    fields: [
      field('en', 'text', { title: 'English', rows: 3 }),
      field('pt', 'text', { title: 'Português (Brasil)', rows: 3 }),
    ],
  },
  {
    name: 'localeMarkdown',
    title: 'Localized Markdown',
    type: 'object',
    fields: [
      field('en', 'text', { title: 'English (Markdown)', rows: 16 }),
      field('pt', 'text', { title: 'Português (Markdown)', rows: 16 }),
    ],
  },
  {
    name: 'metric',
    title: 'Metric',
    type: 'object',
    fields: [
      field('value', 'string'),
      localeString('label'),
      field('countTo', 'number'),
      field('prefix', 'string'),
      field('suffix', 'string'),
    ],
  },
  {
    name: 'experienceRole',
    title: 'Role',
    type: 'object',
    fields: [
      localeString('title'),
      field('start', 'string', { description: 'YYYY-MM' }),
      field('end', 'string', { description: 'YYYY-MM, empty when current' }),
      localeText('summary'),
      field('bullets', 'array', { of: [{ type: 'localeString' }] }),
    ],
  },
  {
    name: 'svgData',
    title: 'SVG geometry',
    type: 'object',
    fields: [field('viewBox', 'string'), field('paths', 'array', { of: [{ type: 'string' }] })],
  },
];

const documents: SchemaType[] = [
  {
    name: 'profile',
    title: 'Profile',
    type: 'document',
    fields: [
      field('displayName', 'string'),
      localeString('jobTitle'),
      localeText('heroLead'),
      field('titleFont', 'string', {
        title: 'Title font',
        description: 'Empty = Geist (default)',
        options: {
          list: titleFonts.map((value) => ({
            title: titleFontLabels[value],
            value,
          })),
        },
      }),
      image('photo'),
      image('photoLg'),
      field('bio', 'localeText'),
      localeString('location'),
      field('spokenLanguages', 'array', { of: [{ type: 'localeString' }] }),
      localeString('focus'),
      field('metrics', 'array', { of: [{ type: 'metric' }] }),
      common[2] as Field,
    ],
  },
  {
    name: 'contact',
    title: 'Contact',
    type: 'document',
    fields: [
      field('email', 'string'),
      field('phone', 'string', { description: 'E.164, e.g. +5541…' }),
      field('showPhone', 'boolean', { initialValue: false }),
      field('bookingUrl', 'url'),
      localeString('ctaHeading'),
      localeText('ctaText'),
      common[2] as Field,
    ],
  },
  {
    name: 'resume',
    title: 'Resume',
    type: 'document',
    fields: [
      field('file', 'object', {
        fields: [
          field('en', 'file', { options: { accept: 'application/pdf' } }),
          field('pt', 'file', { options: { accept: 'application/pdf' } }),
        ],
      }),
      common[2] as Field,
    ],
  },
  {
    name: 'featuredLink',
    title: 'Featured link',
    type: 'document',
    fields: [
      localeString('label'),
      // A string, because Studio's url type rejects mailto: by default.
      field('url', 'string', { description: 'https: or mailto:' }),
      field('kind', 'string', { options: list(['social', 'site', 'other']) }),
      field('icon', 'string', {
        description: 'simple-icons:<slug>, devicon:<slug>, lucide:<name> or link',
      }),
      field('placements', 'array', {
        of: [{ type: 'string' }],
        options: { list: ['header', 'contact', 'footer'] },
      }),
      field('isOwnProfile', 'boolean', { initialValue: false }),
      ...common,
    ],
  },
  {
    name: 'recommendedProfile',
    title: 'Recommended profile',
    type: 'document',
    fields: [
      field('name', 'string'),
      localeString('role'),
      localeText('note'),
      field('avatar', 'image', { options: { hotspot: true } }),
      field('url', 'url'),
      ...common,
    ],
  },
  {
    name: 'project',
    title: 'Project',
    type: 'document',
    fields: [
      field('slug', 'slug'),
      field('previousSlugs', 'array', { of: [{ type: 'string' }] }),
      field('featured', 'boolean', { initialValue: false }),
      field('year', 'number'),
      field('kind', 'string', {
        options: list(['web', 'mobile', 'desktop', 'automation', 'integration', 'open-source']),
      }),
      field('status', 'string', {
        options: list(['live', 'in-progress', 'archived', 'private']),
      }),
      technologyRefs,
      image('cover'),
      field('gallery', 'array', {
        of: [
          {
            type: 'image',
            options: { hotspot: true },
            fields: [localeString('alt', 'Alternative text'), localeString('caption')],
          },
        ],
      }),
      field('links', 'object', {
        fields: [field('live', 'url'), field('repo', 'url')],
      }),
      localeString('title'),
      localeString('tagline'),
      localeText('summary'),
      localeString('role'),
      localeText('context'),
      localeText('approach'),
      field('highlights', 'array', { of: [{ type: 'localeString' }] }),
      localeText('outcome'),
      field('body', 'localeMarkdown'),
      ...common,
    ],
  },
  {
    name: 'experience',
    title: 'Experience',
    type: 'document',
    fields: [
      field('company', 'string'),
      field('companyUrl', 'url'),
      localeString('location'),
      field('roles', 'array', { of: [{ type: 'experienceRole' }] }),
      technologyRefs,
      field('collapsedByDefault', 'boolean', { initialValue: false }),
      ...common,
    ],
  },
  {
    name: 'education',
    title: 'Education',
    type: 'document',
    fields: [
      field('kind', 'string', { options: list(['degree', 'certification']) }),
      localeString('title'),
      field('institution', 'string'),
      field('start', 'string', { description: 'YYYY or YYYY-MM' }),
      field('end', 'string', { description: 'YYYY or YYYY-MM' }),
      field('url', 'url'),
      ...common,
    ],
  },
  {
    name: 'technology',
    title: 'Technology',
    type: 'document',
    fields: [
      field('name', 'string'),
      field('category', 'string', {
        options: list(['language', 'frontend', 'backend', 'data', 'cloud', 'integration', 'ai']),
      }),
      field('iconSource', 'string', {
        options: list(['simple-icons', 'devicon', 'custom-svg', 'monogram']),
      }),
      field('iconSlug', 'string'),
      field('customSvg', 'svgData'),
      field('monogram', 'string', { description: '1–3 capitals or digits' }),
      field('brandColor', 'string', { description: '#rrggbb' }),
      field('url', 'url'),
      field('priority', 'number', {
        options: { list: [1, 2, 3], layout: 'radio' },
      }),
      ...common,
    ],
  },
  {
    name: 'practice',
    title: 'Practice',
    type: 'document',
    fields: [localeString('label'), ...common],
  },
];

export const schemaTypes: SchemaType[] = [...objects, ...documents];
