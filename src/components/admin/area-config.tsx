import { type ComponentType } from 'react';

import { type AdminDoc } from '@/lib/content/admin';

import { isSkillCategory, skillCategoryLabels } from './category-labels';
import { EducationForm, ExperienceForm, type Option } from './forms/career';
import { ContactForm, ProfileForm, ResumeForm } from './forms/identity';
import { LinkForm, RecommendedForm } from './forms/people';
import { ProjectForm } from './forms/project';
import { SkillForm } from './forms/skills';
import { PracticeForm, TechnologyForm } from './forms/stack';

type Values = Record<string, unknown>;

export interface FormOptions {
  skillOptions: Option[];
  techOptions: Option[];
}

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
  Form: ComponentType<FormOptions>;
  hasFeatured?: boolean;
  /**
   * Text to type before deleting, and the editor title.
   */
  name(doc: AdminDoc): string;
  /**
   * The form picks skills: the page loads `skillOptions`.
   */
  needsSkills?: boolean;
  /**
   * The form picks technologies: the page loads `techOptions`.
   */
  needsTechnologies?: boolean;
}

const blank = (): { en: string; pt: string } => ({ en: '', pt: '' });

/**
 * Reads `value.en` from a localized field of an unvalidated document.
 */
const en = (doc: AdminDoc, field: string): string =>
  String((doc[field] as { en?: string } | undefined)?.en ?? '');

const categoriesCell = (doc: AdminDoc): string => {
  const value = doc['categories'];

  if (!Array.isArray(value)) return '';

  return value
    .map(String)
    .map((key) => (isSkillCategory(key) ? skillCategoryLabels[key] : key))
    .join(', ');
};

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
      skillIds: [],
      gallery: [],
      highlights: [blank(), blank(), blank()],
    }),
    Form: ProjectForm,
    needsSkills: true,
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

  skills: {
    columns: ['Name', 'Categories', 'In cloud'],
    filterColumns: [2],
    cells: (doc) => [
      en(doc, 'name'),
      categoriesCell(doc),
      doc['showInCloud'] === true && doc['iconSource'] ? 'Yes' : 'No',
    ],
    name: (doc) => en(doc, 'name'),
    defaults: () => ({
      name: blank(),
      categories: [],
      showInCloud: false,
      priority: 2,
      visible: true,
    }),
    Form: SkillForm,
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
