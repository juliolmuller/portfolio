import { type ContentSource } from '../create-repository';
import { type DocumentInput } from '../schema';
import { createFixtureDataset, type FixtureDataset } from './dataset';

interface Visible {
  visible?: boolean;
}

const isVisible = (document: Visible): boolean => document.visible !== false;

function technologyRefs(dataset: FixtureDataset): Array<{ id: string; visible: boolean }> {
  return dataset.technology.map((tech) => ({
    id: tech.id,
    visible: tech.visible ?? true,
  }));
}

function withoutLongForm(project: DocumentInput<'project'>): {
  approach: { en: string; pt: string };
  context: { en: string; pt: string };
  cover?:
    | {
        alt: { en: string; pt: string };
        asset: { height: number; lqip?: string | undefined; url: string; width: number };
        focal?: { x: number; y: number } | undefined;
      }
    | undefined;
  featured?: boolean | undefined;
  highlights: Array<{ en: string; pt: string }>;
  id: string;
  isFixture?: boolean | undefined;
  kind: 'automation' | 'desktop' | 'integration' | 'mobile' | 'open-source' | 'web';
  links?: { live?: string | undefined; repo?: string | undefined } | undefined;
  order: number;
  outcome?: { en: string; pt: string } | undefined;
  previousSlugs?: string[] | undefined;
  rev?: string | undefined;
  role: { en: string; pt: string };
  slug: string;
  status: 'archived' | 'in-progress' | 'live' | 'private';
  summary: { en: string; pt: string };
  tagline: { en: string; pt: string };
  techIds?: string[] | undefined;
  title: { en: string; pt: string };
  updatedAt: string;
  visible?: boolean | undefined;
  year: number;
} {
  const { body, gallery, ...summary } = project;

  return summary;
}

/**
 * In-memory source for the fictional dataset. Reads return copies so callers
 * can never mutate the store.
 */
export function createFixtureSource(
  dataset: FixtureDataset = createFixtureDataset(),
): ContentSource {
  const read = <T>(value: T): Promise<T> => Promise.resolve(structuredClone(value));

  return {
    name: 'fixtures',
    profile: () => read(dataset.profile[0] ?? null),
    contact: () => read(dataset.contact[0] ?? null),
    resume: () => read(dataset.resume[0] ?? null),
    featuredLinks: () => read(dataset.featuredLink.filter(isVisible)),
    recommendedProfiles: () => read(dataset.recommendedProfile.filter(isVisible)),
    projects: () =>
      read({
        projects: dataset.project.filter(isVisible).map(withoutLongForm),
        technologies: technologyRefs(dataset),
      }),
    projectsBySlug: (slug) =>
      read({
        projects: dataset.project.filter(
          (project) =>
            isVisible(project)
            && (project.slug === slug || (project.previousSlugs ?? []).includes(slug)),
        ),
        technologies: technologyRefs(dataset),
      }),
    experience: () =>
      read({
        entries: dataset.experience.filter(isVisible),
        technologies: technologyRefs(dataset),
      }),
    education: () => read(dataset.education.filter(isVisible)),
    technologies: () => read(dataset.technology.filter(isVisible)),
    practices: () => read(dataset.practice.filter(isVisible)),
    skills: () => read(dataset.skill.filter(isVisible)),
  };
}
