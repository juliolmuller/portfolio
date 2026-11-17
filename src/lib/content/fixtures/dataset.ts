import { type DocumentInput, type DocumentType } from '../schema';
import { education, experience } from './data/career';
import { contact, resume } from './data/contact';
import { featuredLinks, recommendedProfiles } from './data/people';
import { practices } from './data/practices';
import { profile } from './data/profile';
import { projects } from './data/projects';
import { technologies } from './data/technologies';

export type FixtureDataset = {
  [T in DocumentType]: Array<DocumentInput<T>>;
};

/**
 * The fictional dataset of Appendix A, keyed by document type.
 */
export function createFixtureDataset(): FixtureDataset {
  return structuredClone({
    profile: [profile],
    contact: [contact],
    resume: [resume],
    featuredLink: featuredLinks,
    recommendedProfile: recommendedProfiles,
    project: projects,
    experience,
    education,
    technology: technologies,
    practice: practices,
    // Fixture skills arrive in #59.
    skill: [],
  });
}
