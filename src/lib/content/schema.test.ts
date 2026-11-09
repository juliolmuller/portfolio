import { createFixtureDataset } from './fixtures/dataset';
import {
  featuredLinkSchema,
  hasNoRawHtml,
  httpsUrlSchema,
  profileSchema,
  projectSchema,
  slugSchema,
  technologySchema,
} from './schema';

const dataset = createFixtureDataset();
const project = dataset.project[0];
const link = dataset.featuredLink[0];
const tech = dataset.technology[0];
const profile = dataset.profile[0];

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

  it('needs an icon slug for package icon sources', () => {
    expect(
      technologySchema.safeParse({
        ...tech,
        iconSource: 'devicon',
        iconSlug: undefined,
      }).success,
    ).toBe(false);
    expect(technologySchema.safeParse({ ...tech, iconSource: 'custom-svg' }).success).toBe(false);
    expect(technologySchema.safeParse({ ...tech, iconSource: 'custom-image' }).success).toBe(false);
    expect(
      technologySchema.safeParse({
        ...tech,
        iconSource: 'custom-image',
        customImage: {
          asset: { url: 'https://cdn.sanity.io/images/p/d/a-1x1.png', width: 1, height: 1 },
        },
      }).success,
    ).toBe(true);
  });
});
