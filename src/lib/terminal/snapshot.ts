import { type AppLocale } from '@/i18n/routing';
import {
  type Contact,
  type Education,
  type Experience,
  type FeaturedLink,
  type Practice,
  type Profile,
  type ProjectSummary,
  type RecommendedProfile,
  type Resume,
  type Technology,
} from '@/lib/content';

/**
 * Public, localized, JSON-safe content for the terminal. Hidden items never
 * reach it (the repository already filters them) and there is no phone number,
 * icon data or file URL.
 */
export interface ContentSnapshot {
  /**
   * Address parts, joined only in the browser (same idea as the site).
   */
  contact: { bookingUrl?: string; domain: string; user: string } | null;
  education: Array<{
    end?: string;
    institution: string;
    kind: 'certification' | 'degree';
    start?: string;
    title: string;
  }>;
  experience: Array<{
    company: string;
    location?: string;
    roles: Array<{
      bullets: string[];
      end?: string;
      start: string;
      summary: string;
      title: string;
    }>;
    slug: string;
    technologies: string[];
  }>;
  links: Array<{
    isOwnProfile: boolean;
    kind: string;
    label: string;
    url: string;
  }>;
  locale: AppLocale;
  practices: string[];
  profile: {
    bio: string;
    displayName: string;
    focus: string;
    jobTitle: string;
    location: string;
    metrics: Array<{ label: string; value: string }>;
    spokenLanguages: string[];
  } | null;
  projects: Array<{
    approach: string;
    context: string;
    featured: boolean;
    highlights: string[];
    kind: string;
    links: { live?: string; repo?: string };
    outcome?: string;
    role: string;
    slug: string;
    status: string;
    summary: string;
    tagline: string;
    technologies: string[];
    title: string;
    year: number;
  }>;
  recommended: Array<{ name: string; note: string; role: string; url: string }>;
  resume: Record<AppLocale, boolean>;
  technologies: Array<{ category: string; name: string }>;
}

export interface SnapshotSource {
  contact: Contact | null;
  education: Education[];
  experience: Experience[];
  links: FeaturedLink[];
  locale: AppLocale;
  practices: Practice[];
  profile: null | Profile;
  projects: ProjectSummary[];
  recommended: RecommendedProfile[];
  resume: null | Resume;
  technologies: Technology[];
}

export function buildSnapshot(source: SnapshotSource): ContentSnapshot {
  const techNames = new Map(source.technologies.map((t) => [t.id, t.name]));
  const namesOf = (ids: string[]): string[] => ids.flatMap((id) => techNames.get(id) ?? []);
  const [user = '', domain = ''] = source.contact?.email.split('@') ?? [];

  return {
    locale: source.locale,
    profile: source.profile && {
      displayName: source.profile.displayName,
      jobTitle: source.profile.jobTitle,
      bio: source.profile.bio,
      location: source.profile.location,
      spokenLanguages: source.profile.spokenLanguages,
      focus: source.profile.focus,
      metrics: source.profile.metrics.map(({ value, label }) => ({
        value,
        label,
      })),
    },
    contact: source.contact && {
      user,
      domain,
      ...(source.contact.bookingUrl ? { bookingUrl: source.contact.bookingUrl } : {}),
    },
    resume: {
      en: Boolean(source.resume?.files.en),
      pt: Boolean(source.resume?.files.pt),
    },
    links: source.links.map(({ label, url, kind, isOwnProfile }) => ({
      label,
      url,
      kind,
      isOwnProfile,
    })),
    recommended: source.recommended.map(({ name, role, note, url }) => ({
      name,
      role,
      note,
      url,
    })),
    projects: source.projects.map((project) => ({
      slug: project.slug,
      title: project.title,
      tagline: project.tagline,
      summary: project.summary,
      kind: project.kind,
      status: project.status,
      year: project.year,
      featured: project.featured,
      role: project.role,
      context: project.context,
      approach: project.approach,
      highlights: project.highlights,
      ...(project.outcome ? { outcome: project.outcome } : {}),
      links: project.links,
      technologies: namesOf(project.techIds),
    })),
    experience: source.experience.map((entry) => ({
      slug: entry.slug,
      company: entry.company,
      ...(entry.location ? { location: entry.location } : {}),
      roles: entry.roles,
      technologies: namesOf(entry.techIds),
    })),
    education: source.education.map(({ kind, title, institution, start, end }) => ({
      kind,
      title,
      institution,
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
    })),
    technologies: source.technologies.map(({ name, category }) => ({
      name,
      category,
    })),
    practices: source.practices.map((practice) => practice.label),
  };
}

export function emptySnapshot(locale: AppLocale): ContentSnapshot {
  return {
    locale,
    profile: null,
    contact: null,
    resume: { en: false, pt: false },
    links: [],
    recommended: [],
    projects: [],
    experience: [],
    education: [],
    technologies: [],
    practices: [],
  };
}
