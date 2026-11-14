import { type ComponentType } from 'react';

import { type AdminDoc } from '@/lib/content/admin';

import { EducationForm, ExperienceForm, type Option } from './forms/career';
import { ContactForm, ProfileForm, ResumeForm } from './forms/identity';
import { LinkForm, RecommendedForm } from './forms/people';
import { ProjectForm } from './forms/project';
import { PracticeForm, TechnologyForm } from './forms/stack';

type Values = Record<string, unknown>;

export interface AreaConfig {
  cells(doc: AdminDoc): string[];
  /**
   * List columns; the first one links to the editor.
   */
  columns: string[];
  /**
   * A new document's starting values.
   */
  defaults(): Values;
  filterColumns?: number[];
  Form: ComponentType<{ techOptions: Option[] }>;
  hasFeatured?: boolean;
  /**
   * Text to type before deleting, and the editor title.
   */
  name(doc: AdminDoc): string;
  needsTechnologies?: boolean;
}

const blank = (): { en: string; pt: string } => ({ en: '', pt: '' });

/**
 * Reads `value.en` from a localized field of an unvalidated document.
 */
const en = (doc: AdminDoc, field: string): string =>
  String((doc[field] as { en?: string } | undefined)?.en ?? '');
const str = (doc: AdminDoc, field: string): string => String(doc[field] ?? '');

export const AREA_CONFIG: Record<string, AreaConfig> = {
  profile: {
    columns: [],
    cells: () => [],
    name: () => 'Profile',
    defaults: () => ({}),
    Form: ProfileForm,
  },
  contact: {
    columns: [],
    cells: () => [],
    name: () => 'Contact',
    defaults: () => ({}),
    Form: ContactForm,
  },
  resume: {
    columns: [],
    cells: () => [],
    name: () => 'Resume',
    defaults: () => ({ file: {} }),
    Form: ResumeForm,
  },

  links: {
    columns: ['Label', 'Kind', 'URL', 'Appears in'],
    filterColumns: [1],
    cells: (doc) => [
      en(doc, 'label'),
      str(doc, 'kind'),
      str(doc, 'url'),
      ((doc['placements'] as string[] | undefined) ?? []).join(', '),
    ],
    name: (doc) => en(doc, 'label'),
    defaults: () => ({
      label: blank(),
      kind: 'site',
      icon: 'link',
      placements: [],
      isOwnProfile: false,
      visible: true,
    }),
    Form: LinkForm,
  },

  recommended: {
    columns: ['Name', 'Role', 'URL'],
    cells: (doc) => [str(doc, 'name'), en(doc, 'role'), str(doc, 'url')],
    name: (doc) => str(doc, 'name'),
    defaults: () => ({ role: blank(), note: blank(), visible: true }),
    Form: RecommendedForm,
  },

  projects: {
    columns: ['Title', 'Kind', 'Status', 'Year'],
    filterColumns: [1, 2],
    hasFeatured: true,
    cells: (doc) => [en(doc, 'title'), str(doc, 'kind'), str(doc, 'status'), str(doc, 'year')],
    name: (doc) => str(doc, 'slug') || en(doc, 'title'),
    defaults: () => ({
      title: blank(),
      tagline: blank(),
      summary: blank(),
      role: blank(),
      context: blank(),
      approach: blank(),
      year: new Date().getFullYear(),
      kind: 'web',
      status: 'live',
      featured: false,
      visible: true,
      techIds: [],
      gallery: [],
      highlights: [blank(), blank(), blank()],
    }),
    Form: ProjectForm,
    needsTechnologies: true,
  },

  experience: {
    columns: ['Company', 'Latest role', 'Since'],
    cells: (doc) => {
      const first = (
        doc['roles'] as Array<{ start?: string; title?: { en?: string } }> | undefined
      )?.[0];

      return [str(doc, 'company'), first?.title?.en ?? '', first?.start ?? ''];
    },
    name: (doc) => str(doc, 'company'),
    defaults: () => ({
      location: blank(),
      roles: [{ title: blank(), start: '', summary: blank(), bullets: [] }],
      techIds: [],
      collapsedByDefault: false,
      visible: true,
    }),
    Form: ExperienceForm,
    needsTechnologies: true,
  },

  education: {
    columns: ['Title', 'Kind', 'Institution'],
    filterColumns: [1],
    cells: (doc) => [en(doc, 'title'), str(doc, 'kind'), str(doc, 'institution')],
    name: (doc) => en(doc, 'title'),
    defaults: () => ({ kind: 'degree', title: blank(), visible: true }),
    Form: EducationForm,
  },

  technologies: {
    columns: ['Name', 'Category', 'Prominence'],
    filterColumns: [1],
    cells: (doc) => [str(doc, 'name'), str(doc, 'category'), str(doc, 'priority')],
    name: (doc) => str(doc, 'name'),
    defaults: () => ({
      category: 'frontend',
      iconSource: 'monogram',
      priority: 2,
      visible: true,
    }),
    Form: TechnologyForm,
  },

  practices: {
    columns: ['Practice'],
    cells: (doc) => [en(doc, 'label')],
    name: (doc) => en(doc, 'label'),
    defaults: () => ({ label: blank(), visible: true }),
    Form: PracticeForm,
  },
};
