import { createFixtureDataset } from './fixtures/dataset';
import {
  documentSchemas,
  documentTypes,
  experienceSchema,
  featuredLinkSchema,
  hasNoRawHtml,
  httpsUrlSchema,
  linkIconSchema,
  profileSchema,
  projectSchema,
  skillCategories,
  skillSchema,
  slugSchema,
  techCategories,
  technologySchema,
} from './schema';

const dataset = createFixtureDataset();
const project = dataset.project[0];
const link = dataset.featuredLink[0];
const tech = dataset.technology[0];
const profile = dataset.profile[0];
const job = dataset.experience[0];

describe('content schema', () => {
  it.each([
    ['https://example.com/a', true],
    ['http://example.com', false],
    ['javascript:alert(1)', false],
    ['data:text/html,hi', false],
    ['//example.com', false],
    ['https://user@', false],
  ])('httpsUrl %s → %s', (value, ok) => {
    expect(httpsUrlSchema.safeParse(value).success).toBe(ok);
  });

  it.each([
    ['orbit-dashboard', true],
    ['a1', true],
    ['Orbit', false],
    ['-orbit', false],
    ['orbit--x', false],
    ['orbit_x', false],
  ])('slug %s → %s', (value, ok) => {
    expect(slugSchema.safeParse(value).success).toBe(ok);
  });

  it('validates the profile title font and lead length', () => {
    expect(profileSchema.safeParse(profile).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, titleFont: 'comic-sans' }).success).toBe(false);

    const long = 'x'.repeat(121);

    expect(
      profileSchema.safeParse({
        ...profile,
        heroLead: { en: long, pt: long },
      }).success,
    ).toBe(false);
  });

  it('allows an experience without location and caps the role summary at 5000', () => {
    const { location: _location, ...noLocation } = job ?? {};
    const withSummary = (length: number): unknown => ({
      ...job,
      roles: job?.roles.map((role) => ({
        ...role,
        summary: { en: 'x'.repeat(length), pt: 'x'.repeat(length) },
      })),
    });

    expect(experienceSchema.safeParse(noLocation).success).toBe(true);
    expect(experienceSchema.safeParse(withSummary(1000)).success).toBe(true);
    expect(experienceSchema.safeParse(withSummary(5001)).success).toBe(false);
  });

  it('validates devicon link icons', () => {
    for (const ok of ['devicon:linkedin', 'devicon:linkedin-wordmark']) {
      expect(linkIconSchema.safeParse(ok).success, ok).toBe(true);
    }

    for (const bad of [
      'devicon:',
      'devicon:LinkedIn',
      'devicon:linked in',
      'devicon:-x',
      'devicon:x-',
    ]) {
      expect(linkIconSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('rejects the retired hero link placement', () => {
    expect(featuredLinkSchema.safeParse({ ...link, placements: ['hero'] }).success).toBe(false);
    expect(featuredLinkSchema.safeParse({ ...link, placements: ['header'] }).success).toBe(true);
  });

  it('accepts mailto only where allowed', () => {
    expect(
      featuredLinkSchema.safeParse({
        ...link,
        url: 'mailto:hello@example.com',
        isOwnProfile: false,
      }).success,
    ).toBe(true);
    expect(featuredLinkSchema.safeParse({ ...link, url: 'mailto:hello@example.com' }).success).toBe(
      false,
    );
    expect(
      projectSchema.safeParse({
        ...project,
        links: { live: 'mailto:hello@example.com' },
      }).success,
    ).toBe(false);
  });

  it('rejects raw HTML in Markdown but allows it in code', () => {
    expect(hasNoRawHtml('Use `<div>` sparingly.\n\n```html\n<p>x</p>\n```')).toBe(true);
    expect(hasNoRawHtml('Hello <script>alert(1)</script>')).toBe(false);
    expect(hasNoRawHtml('<img src=x onerror=alert(1)>')).toBe(false);
    expect(hasNoRawHtml('a <!-- comment -->')).toBe(false);
    expect(hasNoRawHtml('2 < 3 and 4 > 1')).toBe(true);
  });

  it('requires both locales and enforces length caps', () => {
    expect(projectSchema.safeParse({ ...project, title: { en: 'X', pt: '' } }).success).toBe(false);
    expect(
      projectSchema.safeParse({
        ...project,
        tagline: { en: 'x'.repeat(91), pt: 'y' },
      }).success,
    ).toBe(false);
  });

  it('requires alt text on every image', () => {
    const gallery = project?.gallery ?? [];

    expect(
      projectSchema.safeParse({
        ...project,
        gallery: [{ ...gallery[0], alt: { en: 'Cover', pt: ' ' } }],
      }).success,
    ).toBe(false);
  });

  it('rejects a previous slug equal to the current one', () => {
    expect(projectSchema.safeParse({ ...project, previousSlugs: [project?.slug] }).success).toBe(
      false,
    );
  });

  describe('project skillIds', () => {
    const ids = (count: number): string[] =>
      Array.from(
        { length: count },
        (_, index) => `skill.00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      );

    it('rejects duplicates', () => {
      const [first = ''] = ids(1);
      const result = projectSchema.safeParse({ ...project, skillIds: [first, first] });

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({ path: ['skillIds'], message: 'Duplicate skill' }),
      ]);
    });

    it('caps the list at 32', () => {
      expect(projectSchema.safeParse({ ...project, skillIds: ids(32) }).success).toBe(true);
      expect(projectSchema.safeParse({ ...project, skillIds: ids(33) }).success).toBe(false);
    });

    it('defaults to an empty list', () => {
      const { skillIds: _omitted, ...rest } = project ?? {};
      const result = projectSchema.safeParse(rest);

      expect(result.success && result.data.skillIds).toEqual([]);
    });
  });

  it('needs an icon slug for package icon sources', () => {
    expect(
      technologySchema.safeParse({
        ...tech,
        iconSource: 'devicon',
        iconSlug: undefined,
      }).success,
    ).toBe(false);
    expect(technologySchema.safeParse({ ...tech, iconSource: 'custom-svg' }).success).toBe(false);
  });
});

describe('skill schema', () => {
  const svg = { viewBox: '0 0 24 24', paths: ['M0 0L24 24'] };
  const baseSkill = {
    id: 'skill.test-1',
    updatedAt: '2026-11-15T00:00:00Z',
    name: { en: 'Domain-driven design', pt: 'Domain-driven design' },
    categories: ['engineering'],
    order: 0,
  };
  const issuePaths = (input: unknown): unknown[] => {
    const result = skillSchema.safeParse(input);

    return result.success ? [] : result.error.issues.map((issue) => issue.path);
  };

  it('parses a minimal skill with defaults', () => {
    const result = skillSchema.safeParse(baseSkill);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ showInCloud: false, priority: 2, visible: true });
    expect(result.data?.iconSource).toBeUndefined();
  });

  it.each([
    [{ iconSource: 'simple-icons', iconSlug: 'react' }],
    [{ iconSource: 'devicon', iconSlug: 'react' }],
    [{ iconSource: 'custom-svg', customSvg: svg }],
    [{ iconSource: 'monogram' }],
    [{ iconSource: 'monogram', monogram: 'DD' }],
  ])('accepts icon source %j', (icon) => {
    expect(skillSchema.safeParse({ ...baseSkill, ...icon }).success).toBe(true);
  });

  it('requires the slug or the svg of the chosen source', () => {
    expect(issuePaths({ ...baseSkill, iconSource: 'simple-icons' })).toEqual([['iconSlug']]);
    expect(issuePaths({ ...baseSkill, iconSource: 'devicon' })).toEqual([['iconSlug']]);
    expect(issuePaths({ ...baseSkill, iconSource: 'custom-svg' })).toEqual([['customSvg']]);
  });

  it('validates categories', () => {
    expect(skillSchema.safeParse({ ...baseSkill, categories: [] }).success).toBe(false);
    expect(skillSchema.safeParse({ ...baseSkill, categories: ['skills'] }).success).toBe(false);

    const dup = skillSchema.safeParse({ ...baseSkill, categories: ['data', 'data'] });

    expect(dup.success).toBe(false);
    expect(dup.error?.issues[0]?.message).toBe('Duplicate category');
    expect(skillSchema.safeParse({ ...baseSkill, categories: [...skillCategories] }).success).toBe(
      true,
    );
  });

  it('validates the bilingual name', () => {
    const name = (value: unknown): boolean =>
      skillSchema.safeParse({ ...baseSkill, name: value }).success;

    expect(name({ en: 'X', pt: '' })).toBe(false);
    expect(name({ en: 'X' })).toBe(false);
    expect(name({ en: 'x'.repeat(61), pt: 'x' })).toBe(false);
  });

  it('accepts showInCloud without an icon', () => {
    const result = skillSchema.safeParse({ ...baseSkill, showInCloud: true });

    expect(result.success).toBe(true);
    expect(result.data?.showInCloud).toBe(true);
  });

  it('rejects a bad priority and a non-https url', () => {
    expect(skillSchema.safeParse({ ...baseSkill, priority: 4 }).success).toBe(false);
    expect(skillSchema.safeParse({ ...baseSkill, url: 'http://example.com' }).success).toBe(false);
  });

  it('is registered and extends the technology categories', () => {
    expect(documentSchemas.skill).toBe(skillSchema);
    expect(documentTypes).toContain('skill');
    expect(skillCategories).toEqual([...techCategories, 'engineering']);
  });
});
