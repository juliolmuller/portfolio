import { type ContentSource, type ProjectsRead } from '../create-repository';
import { contentTags } from '../tags';
import {
  CONTACT_QUERY,
  EDUCATION_QUERY,
  EXPERIENCE_QUERY,
  FEATURED_LINKS_QUERY,
  PRACTICES_QUERY,
  PROFILE_QUERY,
  PROJECTS_BY_SLUG_QUERY,
  PROJECTS_QUERY,
  RECOMMENDED_QUERY,
  RESUME_QUERY,
  SKILLS_QUERY,
  TECHNOLOGIES_QUERY,
} from './queries';

/**
 * Runs a GROQ query; the HTTP version caches by `tags`.
 */
export type GroqFetch = (
  query: string,
  params: Record<string, string>,
  tags: readonly string[],
) => Promise<unknown>;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asProjectsRead(value: unknown): ProjectsRead {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    projects: asArray(record.projects),
    technologies: asArray(record.technologies),
  };
}

export function createSanitySource(fetchGroq: GroqFetch): ContentSource {
  const list = async (query: string, tags: readonly string[]): Promise<unknown[]> =>
    asArray(await fetchGroq(query, {}, tags));

  return {
    name: 'sanity',
    profile: () => fetchGroq(PROFILE_QUERY, {}, [contentTags.profile]),
    contact: () => fetchGroq(CONTACT_QUERY, {}, [contentTags.contact]),
    resume: () => fetchGroq(RESUME_QUERY, {}, [contentTags.resume]),
    featuredLinks: () => list(FEATURED_LINKS_QUERY, [contentTags.links]),
    recommendedProfiles: () => list(RECOMMENDED_QUERY, [contentTags.recommended]),
    projects: async () =>
      asProjectsRead(
        await fetchGroq(PROJECTS_QUERY, {}, [contentTags.projects, contentTags.technologies]),
      ),
    projectsBySlug: async (slug) =>
      asProjectsRead(
        await fetchGroq(PROJECTS_BY_SLUG_QUERY, { slug }, [
          contentTags.projects,
          contentTags.project(slug),
          contentTags.technologies,
        ]),
      ),
    experience: async (): Promise<{ entries: unknown[]; technologies: unknown[] }> => {
      const value = await fetchGroq(EXPERIENCE_QUERY, {}, [
        contentTags.experience,
        contentTags.technologies,
      ]);
      const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

      return {
        entries: asArray(record.entries),
        technologies: asArray(record.technologies),
      };
    },
    education: () => list(EDUCATION_QUERY, [contentTags.education]),
    technologies: () => list(TECHNOLOGIES_QUERY, [contentTags.technologies]),
    practices: () => list(PRACTICES_QUERY, [contentTags.practices]),
    skills: () => list(SKILLS_QUERY, [contentTags.skills]),
  };
}
