/**
 * GROQ projections. They rename Sanity's storage shape (`_id`, `slug.current`,
 * references, asset documents) to the field names of `schema.ts`, so the shared
 * pipeline validates Sanity and fixture reads the same way.
 */

const META = /* groq */ `"id": _id, "rev": _rev, "updatedAt": _updatedAt, isFixture`;

const IMAGE = /* groq */ `"asset": asset->{ url, "width": metadata.dimensions.width, "height": metadata.dimensions.height, "lqip": metadata.lqip }, alt, "focal": hotspot{ x, y }`;

const AVATAR = /* groq */ `"avatar": avatar{ "asset": asset->{ url, "width": metadata.dimensions.width, "height": metadata.dimensions.height, "lqip": metadata.lqip }, "focal": hotspot{ x, y } }`;

const VISIBLE = /* groq */ `visible != false`;

const TECH_REFS = /* groq */ `*[_type == "technology"]{ "id": _id, visible }`;

const PROFILE_FIELDS = /* groq */ `
  ${META}, displayName, jobTitle, heroLead, titleFont,
  "photo": photo{ ${IMAGE} },
  "photoLg": photoLg{ ${IMAGE} },
  bio, location, spokenLanguages, focus,
  metrics[]{ value, label, countTo, prefix, suffix }
`;

const CONTACT_FIELDS = /* groq */ `
  ${META}, email, phone, showPhone, bookingUrl, ctaHeading, ctaText`;

const RESUME_FIELDS = /* groq */ `
  ${META},
  "file": {
    "en": file.en.asset->{ url, size, mimeType },
    "pt": file.pt.asset->{ url, size, mimeType }
  }`;

const LINK_FIELDS = /* groq */ `
  ${META}, label, url, kind, icon, placements, isOwnProfile, order, visible`;

const RECOMMENDED_FIELDS = /* groq */ `
  ${META}, name, role, note,
  ${AVATAR},
  url, order, visible`;

const PROJECT_SUMMARY = /* groq */ `
  ${META}, "slug": slug.current, previousSlugs, featured, visible, order,
  year, kind, status, "techIds": technologies[]._ref,
  "cover": cover{ ${IMAGE} },
  links{ live, repo },
  title, tagline, summary, role, context, approach, highlights, outcome`;

const PROJECT_LONG_FORM = /* groq */ `
  "gallery": gallery[]{ ${IMAGE}, caption },
  body`;

const EXPERIENCE_FIELDS = /* groq */ `
  ${META}, company, companyUrl, location,
  roles[]{ title, start, end, summary, bullets },
  "techIds": technologies[]._ref,
  collapsedByDefault, order, visible`;

const EDUCATION_FIELDS = /* groq */ `
  ${META}, kind, title, institution, start, end, url, order, visible`;

const TECHNOLOGY_FIELDS = /* groq */ `
  ${META}, name, category, iconSource, iconSlug,
  customSvg{ viewBox, paths },
  "customImage": customImage{ "asset": asset->{ url, "width": metadata.dimensions.width, "height": metadata.dimensions.height } },
  monogram, brandColor, url, priority, order, visible`;

const PRACTICE_FIELDS = /* groq */ `
  ${META}, label, order, visible`;

export const PROFILE_QUERY = /* groq */ `*[_id == "profile"][0]{${PROFILE_FIELDS}
}`;

export const CONTACT_QUERY = /* groq */ `*[_id == "contact"][0]{${CONTACT_FIELDS}
}`;

export const RESUME_QUERY = /* groq */ `*[_id == "resume"][0]{${RESUME_FIELDS}
}`;

export const FEATURED_LINKS_QUERY = /* groq */ `*[_type == "featuredLink" && ${VISIBLE}] | order(order asc){${LINK_FIELDS}
}`;

export const RECOMMENDED_QUERY = /* groq */ `*[_type == "recommendedProfile" && ${VISIBLE}] | order(order asc){${RECOMMENDED_FIELDS}
}`;

export const PROJECTS_QUERY = /* groq */ `{
  "projects": *[_type == "project" && ${VISIBLE}] | order(order asc){ ${PROJECT_SUMMARY} },
  "technologies": ${TECH_REFS}
}`;

export const PROJECTS_BY_SLUG_QUERY = /* groq */ `{
  "projects": *[_type == "project" && ${VISIBLE} && (slug.current == $slug || $slug in previousSlugs)] | order(order asc){
    ${PROJECT_SUMMARY},
    ${PROJECT_LONG_FORM}
  },
  "technologies": ${TECH_REFS}
}`;

export const EXPERIENCE_QUERY = /* groq */ `{
  "entries": *[_type == "experience" && ${VISIBLE}] | order(order asc){${EXPERIENCE_FIELDS}
  },
  "technologies": ${TECH_REFS}
}`;

export const EDUCATION_QUERY = /* groq */ `*[_type == "education" && ${VISIBLE}] | order(order asc){${EDUCATION_FIELDS}
}`;

export const TECHNOLOGIES_QUERY = /* groq */ `*[_type == "technology" && ${VISIBLE}] | order(order asc, name asc){${TECHNOLOGY_FIELDS}
}`;

export const PRACTICES_QUERY = /* groq */ `*[_type == "practice" && ${VISIBLE}] | order(order asc){${PRACTICE_FIELDS}
}`;

// --- Admin: every document, hidden ones included, one by id -------------------

const ADMIN_FIELDS = {
  profile: PROFILE_FIELDS,
  contact: CONTACT_FIELDS,
  resume: RESUME_FIELDS,
  featuredLink: LINK_FIELDS,
  recommendedProfile: RECOMMENDED_FIELDS,
  project: `${PROJECT_SUMMARY}, ${PROJECT_LONG_FORM}`,
  experience: EXPERIENCE_FIELDS,
  education: EDUCATION_FIELDS,
  technology: TECHNOLOGY_FIELDS,
  practice: PRACTICE_FIELDS,
} as const;

/**
 * Lists leave out the long-form project fields (`body`, `gallery`).
 */
const ADMIN_LIST_FIELDS: Record<keyof typeof ADMIN_FIELDS, string> = {
  ...ADMIN_FIELDS,
  project: PROJECT_SUMMARY,
};

export const adminListQuery = (type: keyof typeof ADMIN_FIELDS): string =>
  `*[_type == "${type}"] | order(order asc, _id asc){${ADMIN_LIST_FIELDS[type]}\n}`;

export const adminGetQuery = (type: keyof typeof ADMIN_FIELDS): string =>
  `*[_type == "${type}" && _id == $id][0]{${ADMIN_FIELDS[type]}\n}`;
