import { z } from 'zod';

import { techCategories, titleFonts } from './taxonomy';

export {
  techCategories,
  type TechCategory,
  type TitleFont,
  titleFontLabels,
  titleFonts,
} from './taxonomy';

/**
 * The content contract. Every adapter hands documents in this shape (localized
 * fields as `{ en, pt }`, image and file assets already resolved) to the shared
 * pipeline, which validates them with these schemas on read. Admin writes use
 * the same schemas (Phase 8).
 */

export const contentLocales = ['en', 'pt'] as const;
export type ContentLocale = (typeof contentLocales)[number];

// --- Primitives --------------------------------------------------------------

const text = (max: number): z.ZodString => z.string().trim().min(1).max(max);

const FENCED_CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const INLINE_CODE = /`[^`\n]*`/g;
const RAW_HTML = /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?\/?>|<!--/i;

/**
 * True when Markdown has no raw HTML outside code spans and code blocks.
 */
export function hasNoRawHtml(markdown: string): boolean {
  return !RAW_HTML.test(markdown.replace(FENCED_CODE, '').replace(INLINE_CODE, ''));
}

const markdown = (max: number): z.ZodString =>
  text(max).refine(hasNoRawHtml, { message: 'Raw HTML is not allowed' });

export const localized = (
  max: number,
): z.ZodObject<{ en: z.ZodString; pt: z.ZodString }, z.core.$strip> =>
  z.object({ en: text(max), pt: text(max) });

export const localizedMarkdown = (
  max: number,
): z.ZodObject<{ en: z.ZodString; pt: z.ZodString }, z.core.$strip> =>
  z.object({ en: markdown(max), pt: markdown(max) });

export type LocalizedText = z.infer<ReturnType<typeof localized>>;

export const slugSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Invalid slug' });

export const httpsUrlSchema = z.url({ protocol: /^https$/, hostname: z.regexes.domain }).max(2048);

export const mailtoUrlSchema = z
  .string()
  .max(320)
  .regex(/^mailto:[^\s@/?#]+@[^\s#/?@][^\s#./?@]*\.[^\s#/?@]+$/, {
    message: 'Invalid mailto URL',
  });

/**
 * Sanity CDN URLs, or files the fixtures adapter serves from `public/`.
 */
export const assetUrlSchema = z.union([
  httpsUrlSchema,
  z
    .string()
    .regex(/^\/fixtures\/[a-z0-9][a-z0-9/._-]*$/)
    .refine((path) => !path.includes('..'), { message: 'Invalid path' }),
]);

export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, { message: 'Expected #rrggbb' });

/**
 * `YYYY-MM`.
 */
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, { message: 'Expected YYYY-MM' });

/**
 * `YYYY` or `YYYY-MM`.
 */
export const partialDateSchema = z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/, {
  message: 'Expected YYYY or YYYY-MM',
});

export const documentIdSchema = z
  .string()
  .max(128)
  .regex(/^[a-z0-9][\w.-]*$/i, { message: 'Invalid document id' });

const orderSchema = z.number().int().min(0).max(1_000_000);
const visibleSchema = z.boolean().default(true);

const documentMeta = {
  id: documentIdSchema,
  rev: z.string().max(64).optional(),
  updatedAt: z.iso.datetime({ offset: true }),
  isFixture: z.boolean().optional(),
};

function isUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

// --- Assets ------------------------------------------------------------------

export const imageAssetSchema = z.object({
  url: assetUrlSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  lqip: z.string().startsWith('data:image/').max(8000).optional(),
});

export const focalPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const imageSchema = z.object({
  asset: imageAssetSchema,
  alt: localized(200),
  focal: focalPointSchema.optional(),
});

/**
 * Avatars derive their alt text from the person's name.
 */
export const avatarSchema = z.object({
  asset: imageAssetSchema,
  focal: focalPointSchema.optional(),
});

export const fileAssetSchema = z.object({
  url: assetUrlSchema,
  size: z.number().int().positive(),
  mimeType: z.literal('application/pdf'),
});

/**
 * Geometry for inline SVG: one `viewBox` and plain `d` attributes.
 */
export const svgDataSchema = z.object({
  viewBox: z.string().regex(/^-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)?$/),
  paths: z
    .array(
      z
        .string()
        .min(1)
        .max(60_000)
        .regex(/^[MZLHVCSQTAE0-9.,\s+-]+$/i),
    )
    .min(1)
    .max(64),
});

export type SvgData = z.infer<typeof svgDataSchema>;

// --- Singletons --------------------------------------------------------------

export const metricSchema = z.object({
  value: text(12),
  label: localized(48),
  countTo: z.number().int().min(0).max(1_000_000).optional(),
  prefix: z.string().max(4).optional(),
  suffix: z.string().max(4).optional(),
});

export const profileSchema = z.object({
  ...documentMeta,
  id: z.literal('profile'),
  displayName: text(80),
  jobTitle: localized(80),
  heroLead: localized(120),
  /**
   * Font of the hero title; unset is the site font.
   */
  titleFont: z.enum(titleFonts).optional(),
  photo: imageSchema.optional(),
  /**
   * Side-by-side hero art (lg+); falls back to `photo` when absent.
   */
  photoLg: imageSchema.optional(),
  bio: localizedMarkdown(1500),
  location: localized(80),
  spokenLanguages: z.array(localized(60)).min(1).max(6),
  focus: localized(120),
  metrics: z.array(metricSchema).max(4).default([]),
});

export const contactSchema = z.object({
  ...documentMeta,
  id: z.literal('contact'),
  email: z.email().max(254),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, { message: 'Expected E.164, e.g. +5541…' })
    .optional(),
  showPhone: z.boolean().default(false),
  bookingUrl: httpsUrlSchema.optional(),
  ctaHeading: localized(80),
  ctaText: localized(280),
});

export const resumeSchema = z.object({
  ...documentMeta,
  id: z.literal('resume'),
  file: z
    .object({
      en: fileAssetSchema.optional(),
      pt: fileAssetSchema.optional(),
    })
    .default({}),
});

// --- Collections -------------------------------------------------------------

export const linkKinds = ['social', 'site', 'other'] as const;
export const linkPlacements = ['header', 'contact', 'footer'] as const;

/**
 * `simple-icons:<slug>`, `lucide:<name>` or the generic `link`.
 */
export const linkIconSchema = z.union([
  z.literal('link'),
  z.string().regex(/^simple-icons:[a-z0-9]+$/),
  z.string().regex(/^lucide:[a-z0-9]+(?:-[a-z0-9]+)*$/),
]);

export const featuredLinkSchema = z
  .object({
    ...documentMeta,
    label: localized(40),
    url: z.union([httpsUrlSchema, mailtoUrlSchema]),
    kind: z.enum(linkKinds),
    icon: linkIconSchema,
    placements: z
      .array(z.enum(linkPlacements))
      .max(linkPlacements.length)
      .default([])
      .refine(isUnique, { message: 'Duplicate placement' }),
    isOwnProfile: z.boolean().default(false),
    order: orderSchema,
    visible: visibleSchema,
  })
  .refine((link) => !link.isOwnProfile || link.url.startsWith('https:'), {
    message: 'Own profiles must be https URLs',
    path: ['isOwnProfile'],
  });

export const recommendedProfileSchema = z.object({
  ...documentMeta,
  name: text(80),
  role: localized(80),
  note: localized(140),
  avatar: avatarSchema.optional(),
  url: httpsUrlSchema,
  order: orderSchema,
  visible: visibleSchema,
});

export const iconSources = [
  'simple-icons',
  'devicon',
  'custom-svg',
  'custom-image',
  'monogram',
] as const;

export const technologySchema = z
  .object({
    ...documentMeta,
    name: text(40),
    category: z.enum(techCategories),
    iconSource: z.enum(iconSources),
    iconSlug: z
      .string()
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    customSvg: svgDataSchema.optional(),
    /**
     * Raster logo with transparency, drawn as its alpha silhouette (D75).
     */
    customImage: z.object({ asset: imageAssetSchema }).optional(),
    /**
     * Overrides the generated monogram (1–3 letters or digits).
     */
    monogram: z
      .string()
      .regex(/^[A-Z0-9]{1,3}$/)
      .optional(),
    brandColor: hexColorSchema.optional(),
    url: httpsUrlSchema.optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    order: orderSchema,
    visible: visibleSchema,
  })
  .superRefine((tech, ctx) => {
    const needsSlug = tech.iconSource === 'simple-icons' || tech.iconSource === 'devicon';

    if (needsSlug && !tech.iconSlug) {
      ctx.addIssue({
        code: 'custom',
        path: ['iconSlug'],
        message: `Required for ${tech.iconSource}`,
      });
    }

    if (tech.iconSource === 'custom-svg' && !tech.customSvg) {
      ctx.addIssue({
        code: 'custom',
        path: ['customSvg'],
        message: 'Required for custom-svg',
      });
    }

    if (tech.iconSource === 'custom-image' && !tech.customImage) {
      ctx.addIssue({
        code: 'custom',
        path: ['customImage'],
        message: 'Required for custom-image',
      });
    }
  });

export const practiceSchema = z.object({
  ...documentMeta,
  label: localized(60),
  order: orderSchema,
  visible: visibleSchema,
});

export const projectKinds = [
  'web',
  'mobile',
  'desktop',
  'automation',
  'integration',
  'open-source',
] as const;
export type ProjectKind = (typeof projectKinds)[number];

export const projectStatuses = ['live', 'in-progress', 'archived', 'private'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const galleryItemSchema = imageSchema.extend({
  caption: localized(160).optional(),
});

export const projectSchema = z
  .object({
    ...documentMeta,
    slug: slugSchema,
    previousSlugs: z.array(slugSchema).max(10).default([]),
    featured: z.boolean().default(false),
    visible: visibleSchema,
    order: orderSchema,
    year: z.number().int().min(1990).max(2100),
    kind: z.enum(projectKinds),
    status: z.enum(projectStatuses),
    techIds: z.array(documentIdSchema).max(24).default([]),
    cover: imageSchema.optional(),
    gallery: z.array(galleryItemSchema).max(12).default([]),
    links: z
      .object({
        live: httpsUrlSchema.optional(),
        repo: httpsUrlSchema.optional(),
      })
      .default({}),
    title: localized(80),
    tagline: localized(90),
    summary: localized(160),
    role: localized(80),
    context: localized(1200),
    approach: localized(1200),
    highlights: z.array(localized(160)).min(3).max(5),
    outcome: localized(400).optional(),
    body: localizedMarkdown(20_000).optional(),
  })
  .superRefine((project, ctx) => {
    if (!isUnique(project.techIds)) {
      ctx.addIssue({
        code: 'custom',
        path: ['techIds'],
        message: 'Duplicate technology',
      });
    }

    if (project.previousSlugs.includes(project.slug) || !isUnique(project.previousSlugs)) {
      ctx.addIssue({
        code: 'custom',
        path: ['previousSlugs'],
        message: 'Must be unique and differ from the current slug',
      });
    }
  });

export const experienceRoleSchema = z
  .object({
    title: localized(80),
    start: yearMonthSchema,
    end: yearMonthSchema.optional(),
    summary: localized(400),
    bullets: z.array(localized(200)).max(6).default([]),
  })
  .refine((role) => !role.end || role.end >= role.start, {
    message: 'End must not precede start',
    path: ['end'],
  });

export const experienceSchema = z.object({
  ...documentMeta,
  company: text(80),
  companyUrl: httpsUrlSchema.optional(),
  location: localized(80),
  roles: z.array(experienceRoleSchema).min(1).max(10),
  techIds: z
    .array(documentIdSchema)
    .max(32)
    .default([])
    .refine(isUnique, { message: 'Duplicate technology' }),
  collapsedByDefault: z.boolean().default(false),
  order: orderSchema,
  visible: visibleSchema,
});

export const educationKinds = ['degree', 'certification'] as const;

export const educationSchema = z
  .object({
    ...documentMeta,
    kind: z.enum(educationKinds),
    title: localized(120),
    institution: text(120),
    start: partialDateSchema.optional(),
    end: partialDateSchema.optional(),
    url: httpsUrlSchema.optional(),
    order: orderSchema,
    visible: visibleSchema,
  })
  .refine((entry) => !entry.start || !entry.end || entry.end >= entry.start, {
    message: 'End must not precede start',
    path: ['end'],
  });

// --- Registry ----------------------------------------------------------------

export const documentSchemas = {
  profile: profileSchema,
  contact: contactSchema,
  resume: resumeSchema,
  featuredLink: featuredLinkSchema,
  recommendedProfile: recommendedProfileSchema,
  project: projectSchema,
  experience: experienceSchema,
  education: educationSchema,
  technology: technologySchema,
  practice: practiceSchema,
} as const;

export type DocumentType = keyof typeof documentSchemas;
export const documentTypes = Object.keys(documentSchemas) as DocumentType[];

export type DocumentOf<T extends DocumentType> = z.infer<(typeof documentSchemas)[T]>;
/**
 * Authoring shape (defaults optional), used by fixtures and the seed.
 */
export type DocumentInput<T extends DocumentType> = z.input<(typeof documentSchemas)[T]>;

export type ProfileDocument = DocumentOf<'profile'>;
export type ContactDocument = DocumentOf<'contact'>;
export type ResumeDocument = DocumentOf<'resume'>;
export type FeaturedLinkDocument = DocumentOf<'featuredLink'>;
export type RecommendedProfileDocument = DocumentOf<'recommendedProfile'>;
export type ProjectDocument = DocumentOf<'project'>;
export type ExperienceDocument = DocumentOf<'experience'>;
export type EducationDocument = DocumentOf<'education'>;
export type TechnologyDocument = DocumentOf<'technology'>;
export type PracticeDocument = DocumentOf<'practice'>;
export type ImageField = z.infer<typeof imageSchema>;
export type ImageAsset = z.infer<typeof imageAssetSchema>;
export type FileAsset = z.infer<typeof fileAssetSchema>;
