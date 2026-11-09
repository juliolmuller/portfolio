import { createHash } from 'node:crypto';

import { type FixtureDataset } from '../fixtures/dataset';
import {
  type DocumentInput,
  type DocumentType,
  type FileAsset,
  type ImageAsset,
  type LocalizedText,
} from '../schema';

/**
 * Converts authoring documents (schema shape) into Sanity storage documents.
 * Asset URLs are mapped to Sanity asset ids by the caller: the seed uploads
 * files first, the in-memory tests synthesize asset documents.
 */

export interface SanityDocument {
  _id: string;
  _type: string;
  [field: string]: unknown;
}

export interface AssetResolver {
  file(asset: FileAsset): string;
  image(asset: ImageAsset): string;
}

function key(...parts: Array<number | string>): string {
  return createHash('sha1').update(parts.join(':')).digest('hex').slice(0, 12);
}

const localeString = (value: LocalizedText): { _type: string; en: string; pt: string } => ({
  _type: 'localeString',
  ...value,
});
const localeText = (value: LocalizedText): { _type: string; en: string; pt: string } => ({
  _type: 'localeText',
  ...value,
});

function localeStrings(
  id: string,
  field: string,
  values: LocalizedText[],
): Array<{ _key: string; _type: string; en: string; pt: string }> {
  return values.map((value, index) => ({
    _key: key(id, field, index),
    ...localeString(value),
  }));
}

function optional<T, R>(value: T | undefined, map: (value: T) => R): R | undefined {
  return value === undefined ? undefined : map(value);
}

interface ImageInput {
  alt?: LocalizedText;
  asset: ImageAsset;
  focal?: { x: number; y: number };
}

function image(
  assets: AssetResolver,
  input: ImageInput,
): {
  _type: string;
  alt?: { _type: string; en: string; pt: string } | undefined;
  asset: { _ref: string; _type: string };
  hotspot?: { _type: string; height: number; width: number; x: number; y: number } | undefined;
} {
  return {
    _type: 'image',
    asset: { _type: 'reference', _ref: assets.image(input.asset) },
    ...(input.alt ? { alt: localeString(input.alt) } : {}),
    ...(input.focal
      ? {
          hotspot: {
            _type: 'sanity.imageHotspot',
            x: input.focal.x,
            y: input.focal.y,
            width: 1,
            height: 1,
          },
        }
      : {}),
  };
}

function references(
  id: string,
  field: string,
  ids: readonly string[] = [],
): Array<{ _key: string; _ref: string; _type: string }> {
  return ids.map((ref, index) => ({
    _key: key(id, field, index),
    _type: 'reference',
    _ref: ref,
  }));
}

function compact(document: Record<string, unknown>): SanityDocument {
  return Object.fromEntries(
    Object.entries(document).filter(([, value]) => value !== undefined),
  ) as SanityDocument;
}

function base<T extends DocumentType>(
  type: T,
  doc: DocumentInput<T>,
): { _id: string; _type: T; isFixture: boolean | undefined } {
  return { _id: doc.id, _type: type, isFixture: doc.isFixture };
}

type Converters = {
  [T in DocumentType]: (doc: DocumentInput<T>, assets: AssetResolver) => SanityDocument;
};

const converters: Converters = {
  profile: (doc, assets) =>
    compact({
      ...base('profile', doc),
      displayName: doc.displayName,
      jobTitle: localeString(doc.jobTitle),
      heroLead: localeText(doc.heroLead),
      titleFont: doc.titleFont,
      photo: optional(doc.photo, (photo) => image(assets, photo)),
      photoLg: optional(doc.photoLg, (photo) => image(assets, photo)),
      bio: localeText(doc.bio),
      location: localeString(doc.location),
      spokenLanguages: localeStrings(doc.id, 'spokenLanguages', doc.spokenLanguages),
      focus: localeString(doc.focus),
      metrics: (doc.metrics ?? []).map((metric, index) =>
        compact({
          _key: key(doc.id, 'metrics', index),
          _type: 'metric',
          value: metric.value,
          label: localeString(metric.label),
          countTo: metric.countTo,
          prefix: metric.prefix,
          suffix: metric.suffix,
        }),
      ),
    }),

  contact: (doc) =>
    compact({
      ...base('contact', doc),
      email: doc.email,
      phone: doc.phone,
      showPhone: doc.showPhone ?? false,
      bookingUrl: doc.bookingUrl,
      ctaHeading: localeString(doc.ctaHeading),
      ctaText: localeText(doc.ctaText),
    }),

  resume: (doc, assets) =>
    compact({
      ...base('resume', doc),
      file: compact({
        en: optional(doc.file?.en, (file) => ({
          _type: 'file',
          asset: { _type: 'reference', _ref: assets.file(file) },
        })),
        pt: optional(doc.file?.pt, (file) => ({
          _type: 'file',
          asset: { _type: 'reference', _ref: assets.file(file) },
        })),
      }),
    }),

  featuredLink: (doc) =>
    compact({
      ...base('featuredLink', doc),
      label: localeString(doc.label),
      url: doc.url,
      kind: doc.kind,
      icon: doc.icon,
      placements: doc.placements ?? [],
      isOwnProfile: doc.isOwnProfile ?? false,
      order: doc.order,
      visible: doc.visible ?? true,
    }),

  recommendedProfile: (doc, assets) =>
    compact({
      ...base('recommendedProfile', doc),
      name: doc.name,
      role: localeString(doc.role),
      note: localeText(doc.note),
      avatar: optional(doc.avatar, (avatar) => image(assets, avatar)),
      url: doc.url,
      order: doc.order,
      visible: doc.visible ?? true,
    }),

  project: (doc, assets) =>
    compact({
      ...base('project', doc),
      slug: { _type: 'slug', current: doc.slug },
      previousSlugs: doc.previousSlugs ?? [],
      featured: doc.featured ?? false,
      visible: doc.visible ?? true,
      order: doc.order,
      year: doc.year,
      kind: doc.kind,
      status: doc.status,
      technologies: references(doc.id, 'technologies', doc.techIds),
      cover: optional(doc.cover, (cover) => image(assets, cover)),
      gallery: (doc.gallery ?? []).map((item, index) => ({
        _key: key(doc.id, 'gallery', index),
        ...image(assets, item),
        ...(item.caption ? { caption: localeString(item.caption) } : {}),
      })),
      links: compact({ live: doc.links?.live, repo: doc.links?.repo }),
      title: localeString(doc.title),
      tagline: localeString(doc.tagline),
      summary: localeText(doc.summary),
      role: localeString(doc.role),
      context: localeText(doc.context),
      approach: localeText(doc.approach),
      highlights: localeStrings(doc.id, 'highlights', doc.highlights),
      outcome: optional(doc.outcome, localeText),
      body: optional(doc.body, (body) => ({
        _type: 'localeMarkdown',
        ...body,
      })),
    }),

  experience: (doc) =>
    compact({
      ...base('experience', doc),
      company: doc.company,
      companyUrl: doc.companyUrl,
      location: localeString(doc.location),
      roles: doc.roles.map((role, index) =>
        compact({
          _key: key(doc.id, 'roles', index),
          _type: 'experienceRole',
          title: localeString(role.title),
          start: role.start,
          end: role.end,
          summary: localeText(role.summary),
          bullets: localeStrings(doc.id, `roles.${index}.bullets`, role.bullets ?? []),
        }),
      ),
      technologies: references(doc.id, 'technologies', doc.techIds),
      collapsedByDefault: doc.collapsedByDefault ?? false,
      order: doc.order,
      visible: doc.visible ?? true,
    }),

  education: (doc) =>
    compact({
      ...base('education', doc),
      kind: doc.kind,
      title: localeString(doc.title),
      institution: doc.institution,
      start: doc.start,
      end: doc.end,
      url: doc.url,
      order: doc.order,
      visible: doc.visible ?? true,
    }),

  technology: (doc, assets) =>
    compact({
      ...base('technology', doc),
      name: doc.name,
      category: doc.category,
      iconSource: doc.iconSource,
      iconSlug: doc.iconSlug,
      customSvg: optional(doc.customSvg, (svg) => ({
        _type: 'svgData',
        ...svg,
      })),
      customImage: optional(doc.customImage, (logo) => image(assets, logo)),
      monogram: doc.monogram,
      brandColor: doc.brandColor,
      url: doc.url,
      priority: doc.priority,
      order: doc.order,
      visible: doc.visible ?? true,
    }),

  practice: (doc) =>
    compact({
      ...base('practice', doc),
      label: localeString(doc.label),
      order: doc.order,
      visible: doc.visible ?? true,
    }),
};

export function toSanityDocument<T extends DocumentType>(
  type: T,
  doc: DocumentInput<T>,
  assets: AssetResolver,
): SanityDocument {
  // Correlated union: `converters[type]` always accepts `DocumentInput<T>`.
  const convert = converters[type] as (
    doc: DocumentInput<T>,
    assets: AssetResolver,
  ) => SanityDocument;

  return convert(doc, assets);
}

/**
 * Every document of a dataset, singletons first, in a stable order.
 */
export function toSanityDocuments(
  dataset: FixtureDataset,
  assets: AssetResolver,
): SanityDocument[] {
  return (Object.keys(dataset) as DocumentType[]).flatMap((type) =>
    dataset[type].map((doc) => toSanityDocument(type, doc, assets)),
  );
}
