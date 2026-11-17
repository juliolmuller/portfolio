import { type ContentLocale } from './schema';
import {
  type Contact,
  type Education,
  type Experience,
  type FeaturedLink,
  type Practice,
  type Profile,
  type ProjectLookup,
  type ProjectRoute,
  type ProjectSummary,
  type RecommendedProfile,
  type Resume,
  type Skill,
  type Technology,
} from './types';

/**
 * The only way the app reads content. Every list is visible-only and sorted by
 * `order`; singletons resolve to `null` when missing or invalid.
 */
export interface ContentRepository {
  getContact(locale: ContentLocale): Promise<Contact | null>;

  getEducation(locale: ContentLocale): Promise<Education[]>;
  getExperience(locale: ContentLocale): Promise<Experience[]>;
  getFeaturedLinks(locale: ContentLocale): Promise<FeaturedLink[]>;
  getPractices(locale: ContentLocale): Promise<Practice[]>;
  getProfile(locale: ContentLocale): Promise<null | Profile>;
  /**
   * Resolves current slugs, answers `moved` for previous slugs.
   */
  getProject(locale: ContentLocale, slug: string): Promise<ProjectLookup>;
  getProjectRoutes(): Promise<ProjectRoute[]>;
  getProjects(locale: ContentLocale): Promise<ProjectSummary[]>;
  getRecommendedProfiles(locale: ContentLocale): Promise<RecommendedProfile[]>;
  getResume(): Promise<null | Resume>;
  getSkills(locale: ContentLocale): Promise<Skill[]>;
  getTechnologies(locale: ContentLocale): Promise<Technology[]>;
  readonly source: 'fixtures' | 'sanity';
}
