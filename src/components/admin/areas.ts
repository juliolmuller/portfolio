import { type DocumentType } from '@/lib/content/schema';

export interface AreaMeta {
  label: string;
  singleton?: boolean;
  /**
   * Singular noun for buttons and titles.
   */
  singular: string;
  slug: string;
  type: DocumentType;
}

/**
 * The admin areas, in sidebar order (after the dashboard).
 */
export const AREAS: AreaMeta[] = [
  {
    slug: 'profile',
    label: 'Profile',
    singular: 'profile',
    type: 'profile',
    singleton: true,
  },
  { slug: 'links', label: 'Links', singular: 'link', type: 'featuredLink' },
  {
    slug: 'recommended',
    label: 'Recommended',
    singular: 'profile',
    type: 'recommendedProfile',
  },
  { slug: 'projects', label: 'Projects', singular: 'project', type: 'project' },
  {
    slug: 'experience',
    label: 'Experience',
    singular: 'job',
    type: 'experience',
  },
  {
    slug: 'education',
    label: 'Education',
    singular: 'entry',
    type: 'education',
  },
  {
    slug: 'technologies',
    label: 'Technologies',
    singular: 'technology',
    type: 'technology',
  },
  {
    slug: 'practices',
    label: 'Practices',
    singular: 'practice',
    type: 'practice',
  },
  {
    slug: 'contact',
    label: 'Contact',
    singular: 'contact',
    type: 'contact',
    singleton: true,
  },
  {
    slug: 'resume',
    label: 'Resume',
    singular: 'resume',
    type: 'resume',
    singleton: true,
  },
];

export const findArea = (slug: string): AreaMeta | undefined =>
  AREAS.find((area) => area.slug === slug);

export const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin' },
  ...AREAS.map((area) => ({ label: area.label, href: `/admin/${area.slug}` })),
];

/**
 * Document ids look like `recommendedProfile.<uuid>`, but the proxy lowercases
 * every public URL, so admin URLs carry only the uuid part.
 */
export const idToSegment = (type: DocumentType, id: string): string =>
  id.startsWith(`${type}.`) ? id.slice(type.length + 1) : id;

export const segmentToId = (type: DocumentType, segment: string): string =>
  segment.includes('.') ? segment : `${type}.${segment}`;
