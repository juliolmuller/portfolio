import {
  type ImageAsset,
  type linkKinds,
  type linkPlacements,
  type ProjectKind,
  type ProjectStatus,
  type SvgData,
  type TechCategory,
  type TitleFont,
} from './schema';

/**
 * What the repository returns: one locale, hidden items removed, icons
 * resolved, the phone number only when the owner enabled it.
 */

export interface ImageRef {
  alt: string;
  focal?: { x: number; y: number };
  height: number;
  lqip?: string;
  url: string;
  width: number;
}

export interface FileRef {
  size: number;
  url: string;
}

export interface Metric {
  countTo?: number;
  label: string;
  prefix?: string;
  suffix?: string;
  value: string;
}

export interface Profile {
  /**
   * Markdown.
   */
  bio: string;
  displayName: string;
  focus: string;
  heroLead: string;
  jobTitle: string;
  location: string;
  metrics: Metric[];
  photo?: ImageRef;
  /**
   * Side-by-side hero art (lg+); falls back to `photo` when absent.
   */
  photoLg?: ImageRef;
  spokenLanguages: string[];
  titleFont?: TitleFont;
  updatedAt: string;
}

export interface Contact {
  bookingUrl?: string;
  ctaHeading: string;
  ctaText: string;
  email: string;
  /**
   * Present only when `showPhone` is enabled.
   */
  phone?: string;
}

export interface Resume {
  files: Partial<Record<'en' | 'pt', FileRef>>;
  updatedAt: string;
}

export type LinkKind = (typeof linkKinds)[number];
export type LinkPlacement = (typeof linkPlacements)[number];

export type LinkIcon = { name: string; type: 'lucide' } | ({ type: 'svg' } & SvgData);

export interface FeaturedLink {
  icon: LinkIcon;
  id: string;
  isOwnProfile: boolean;
  kind: LinkKind;
  label: string;
  order: number;
  placements: LinkPlacement[];
  url: string;
}

export interface RecommendedProfile {
  avatar?: ImageRef;
  id: string;
  name: string;
  note: string;
  order: number;
  role: string;
  url: string;
}

/**
 * Paths, a raster image drawn as its alpha silhouette (D75), or a monogram.
 */
export type TechIcon = { image: ImageAsset } | { monogram: string } | SvgData;

export interface Technology {
  brandColor?: string;
  category: TechCategory;
  icon: TechIcon;
  id: string;
  name: string;
  order: number;
  priority: 1 | 2 | 3;
  url?: string;
}

export interface Practice {
  id: string;
  label: string;
  order: number;
}

export interface GalleryImage extends ImageRef {
  caption?: string;
}

export interface Project {
  approach: string;
  /**
   * Markdown (GFM).
   */
  body?: string;
  context: string;
  cover?: ImageRef;
  featured: boolean;
  gallery: GalleryImage[];
  highlights: string[];
  id: string;
  kind: ProjectKind;
  links: { live?: string; repo?: string };
  order: number;
  outcome?: string;
  previousSlugs: string[];
  role: string;
  slug: string;
  status: ProjectStatus;
  summary: string;
  tagline: string;
  /**
   * Visible technologies only.
   */
  techIds: string[];
  title: string;
  updatedAt: string;
  visible: true;
  year: number;
}

/**
 * Cards, lists and the terminal: everything except the long-form parts.
 */
export type ProjectSummary = Omit<Project, 'body' | 'gallery'>;

export type ProjectLookup =
  { project: Project; status: 'found' } | { slug: string; status: 'moved' } | { status: 'missing' };

export interface ProjectRoute {
  slug: string;
  updatedAt: string;
}

export interface ExperienceRole {
  bullets: string[];
  end?: string;
  start: string;
  summary: string;
  title: string;
}

export interface Experience {
  collapsedByDefault: boolean;
  company: string;
  companyUrl?: string;
  id: string;
  location?: string;
  order: number;
  roles: ExperienceRole[];
  /**
   * Derived from `company`; unique across visible entries.
   */
  slug: string;
  techIds: string[];
}

export interface Education {
  end?: string;
  id: string;
  institution: string;
  kind: 'certification' | 'degree';
  order: number;
  start?: string;
  title: string;
  url?: string;
}
