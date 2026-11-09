import { owner } from '@/config/site';

import { createRecordingLogger } from '../../../tests/support/content-logger';
import { createFixtureDataset, type FixtureDataset } from './fixtures/dataset';
import { techId } from './fixtures/ids';
import { type ContentLogger } from './log';
import { type ContentRepository } from './repository';
import { contentLocales, techCategories } from './schema';

export type RepositoryFactory = (
  dataset: FixtureDataset,
  logger: ContentLogger,
) => ContentRepository;

const wordCount = (markdown: string): number =>
  markdown.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

/**
 * Behavior every adapter must share. Each test builds its repository from a
 * (possibly modified) copy of the fixture dataset.
 */
export function describeRepositoryContract(name: string, factory: RepositoryFactory): void {
  describe(`ContentRepository contract: ${name}`, () => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred type is the clearest description
    function setup(mutate?: (dataset: FixtureDataset) => void) {
      const dataset = createFixtureDataset();

      mutate?.(dataset);

      const logger = createRecordingLogger();

      return { repository: factory(dataset, logger), logger };
    }

    it('resolves the profile in each locale', async () => {
      const { repository } = setup();
      const en = await repository.getProfile('en');
      const pt = await repository.getProfile('pt');

      expect(en?.displayName).toBe(owner.name);
      expect(en?.jobTitle).toBe(owner.jobTitle);
      expect(en?.heroLead).toBe('I design and build web software, end to end.');
      expect(pt?.heroLead).not.toBe(en?.heroLead);
      expect(en?.titleFont).toBe('kaushan-script');
      expect(en?.metrics).toHaveLength(4);
      expect(en?.photo?.alt).toBeTruthy();
      expect(pt?.photo?.alt).not.toBe(en?.photo?.alt);
      expect(en?.photo?.width).toBe(en?.photo?.height);
      expect(en?.photoLg?.url).toBeTruthy();
      expect(en?.photoLg?.url).not.toBe(en?.photo?.url);
    });

    it('never exposes the phone unless showPhone is on', async () => {
      const hidden = setup((dataset) => {
        const contact = dataset.contact[0];

        if (contact) Object.assign(contact, { phone: '+5541999990000' });
      });

      expect(await hidden.repository.getContact('en')).not.toHaveProperty('phone');

      const shown = setup((dataset) => {
        const contact = dataset.contact[0];

        if (contact) {
          Object.assign(contact, { phone: '+5541999990000', showPhone: true });
        }
      });

      expect((await shown.repository.getContact('en'))?.phone).toBe('+5541999990000');
    });

    it('returns both résumé files', async () => {
      const { repository } = setup();
      const resume = await repository.getResume();

      expect(resume?.files.en?.url).toMatch(/\.pdf$/);
      expect(resume?.files.pt?.size).toBeGreaterThan(0);
    });

    it('lists visible featured links with resolved icons', async () => {
      const { repository } = setup();
      const links = await repository.getFeaturedLinks('en');

      expect(links.map((link) => link.label)).toEqual(['GitHub', 'LinkedIn', 'Talks and slides']);
      expect(links[0]?.icon.type).toBe('svg');
      expect(links[2]?.icon).toEqual({ type: 'lucide', name: 'presentation' });
      expect(links.filter((link) => link.isOwnProfile)).toHaveLength(2);
    });

    it('lists visible recommended profiles with derived alt text', async () => {
      const { repository } = setup();
      const people = await repository.getRecommendedProfiles('pt');

      expect(people.map((person) => person.name)).toEqual([
        'Ada Sample',
        'Marco Placeholder',
        'Lin Example',
      ]);
      expect(people[0]?.avatar?.alt).toBe('Ada Sample');
      for (const person of people) {
        expect(person.note.length).toBeLessThanOrEqual(140);
      }
    });

    it('lists visible projects by order, without hidden ones', async () => {
      const { repository } = setup();
      const projects = await repository.getProjects('en');

      expect(projects.map((project) => project.slug)).toEqual([
        'orbit-dashboard',
        'pocket-ledger',
        'pay-bridge',
        'lint-kit',
        'tidy-desk',
        'invoice-bot',
      ]);
      expect(projects.every((project) => !('body' in project))).toBe(true);
      expect(projects.find((p) => p.slug === 'invoice-bot')?.cover).toBe(undefined);

      const technologyIds = new Set(
        (await repository.getTechnologies('en')).map((tech) => tech.id),
      );
      for (const project of projects) {
        expect(project.techIds.every((id) => technologyIds.has(id))).toBe(true);
      }
    });

    it('finds a project with its long-form content', async () => {
      const { repository } = setup();
      for (const locale of contentLocales) {
        const lookup = await repository.getProject(locale, 'orbit-dashboard');

        expect(lookup.status).toBe('found');

        if (lookup.status !== 'found') continue;

        expect(lookup.project.gallery).toHaveLength(3);
        expect(lookup.project.gallery[0]?.caption).toBeTruthy();
        expect(lookup.project.techIds).toHaveLength(5);
        expect(wordCount(lookup.project.body ?? '')).toBeGreaterThanOrEqual(400);
      }
    });

    it('answers previous slugs with the current one', async () => {
      const { repository } = setup();

      expect(await repository.getProject('en', 'paybridge')).toEqual({
        status: 'moved',
        slug: 'pay-bridge',
      });
      expect(await repository.getProject('en', 'nope')).toEqual({
        status: 'missing',
      });
      expect(await repository.getProject('en', 'scratch-pad')).toEqual({
        status: 'missing',
      });
    });

    it('lists project routes without hidden projects', async () => {
      const { repository } = setup();
      const routes = await repository.getProjectRoutes();

      expect(routes).toHaveLength(6);
      expect(routes.map((route) => route.slug)).not.toContain('scratch-pad');
      expect(routes.every((route) => route.updatedAt)).toBe(true);
    });

    it('resolves experience with derived slugs', async () => {
      const { repository } = setup();
      const entries = await repository.getExperience('pt');

      expect(entries.map((entry) => entry.slug)).toEqual([
        'lumen-works',
        'northbridge-labs',
        'fable-co',
      ]);
      expect(entries[0]?.roles[0]?.end).toBeUndefined();
      expect(entries[2]?.collapsedByDefault).toBe(true);
      expect(entries[0]?.roles[0]?.title).toBe('Engenheiro Full Stack Sênior');
    });

    it('lists education entries', async () => {
      const { repository } = setup();
      const entries = await repository.getEducation('en');

      expect(entries.map((entry) => entry.kind)).toEqual([
        'degree',
        'certification',
        'certification',
      ]);
    });

    it('resolves all seeded technologies with icons (D37)', async () => {
      const { repository } = setup();
      const technologies = await repository.getTechnologies('en');

      expect(technologies).toHaveLength(96);

      const byPriority = [1, 2, 3].map(
        (priority) => technologies.filter((tech) => tech.priority === priority).length,
      );

      expect(byPriority).toEqual([21, 28, 47]);
      expect(
        Object.fromEntries(
          techCategories.map((category) => [
            category,
            technologies.filter((tech) => tech.category === category).length,
          ]),
        ),
      ).toEqual({
        language: 15,
        frontend: 17,
        backend: 17,
        data: 10,
        cloud: 16,
        integration: 15,
        ai: 6,
      });

      const monograms = technologies
        .filter((tech) => 'monogram' in tech.icon)
        .map((tech) => tech.name)
        .sort();

      expect(monograms).toEqual([
        'Excel / Power Query',
        'GPT',
        'Power BI',
        'SharePoint',
        'VS Code',
      ]);
      for (const tech of technologies) {
        if ('paths' in tech.icon) {
          expect(tech.icon.paths.length).toBeGreaterThan(0);
        }

        if ('image' in tech.icon) {
          expect(tech.icon.image.url).toMatch(/^(?:https:\/\/|\/fixtures\/)/);
        }

        expect(tech.brandColor ?? '#000000').toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('lists practices', async () => {
      const { repository } = setup();
      const practices = await repository.getPractices('pt');

      expect(practices).toHaveLength(16);
      expect(practices[4]?.label).toBe('Microsserviços');
    });

    it('drops references to hidden technologies', async () => {
      const { repository } = setup((dataset) => {
        const react = dataset.technology.find((tech) => tech.id === techId('React'));

        if (react) react.visible = false;
      });
      const technologies = await repository.getTechnologies('en');

      expect(technologies.map((tech) => tech.name)).not.toContain('React');

      const [orbit] = await repository.getProjects('en');

      expect(orbit?.techIds).not.toContain(techId('React'));
      expect(orbit?.techIds).toHaveLength(4);
    });

    it('skips and logs an invalid document', async () => {
      const { repository, logger } = setup((dataset) => {
        const lint = dataset.project.find((p) => p.slug === 'lint-kit');

        if (lint) lint.slug = 'Lint Kit!';
      });
      const slugs = (await repository.getProjects('en')).map((p) => p.slug);

      expect(slugs).toHaveLength(5);
      expect(slugs).not.toContain('lint-kit');

      const warning = logger.warnings.find((entry) => entry.event === 'invalid-document');

      expect(warning?.details).toMatchObject({ type: 'project' });
      expect(String(warning?.details.issues)).toContain('slug');
      expect(String(warning?.details.issues)).not.toContain('Lint Kit!');
    });

    it('falls back to English for a missing translation', async () => {
      const { repository, logger } = setup((dataset) => {
        const profile = dataset.profile[0];

        if (profile) profile.focus = { en: profile.focus.en, pt: '' };
      });
      const pt = await repository.getProfile('pt');

      expect(pt?.focus).toBe('Web platforms and APIs');
      expect(logger.warnings).toContainEqual({
        event: 'missing-translation',
        details: expect.objectContaining({ type: 'profile', path: 'focus' }),
      });
    });

    it('keeps the first project when two share a slug', async () => {
      const { repository, logger } = setup((dataset) => {
        const tidy = dataset.project.find((p) => p.slug === 'tidy-desk');

        if (tidy) tidy.slug = 'lint-kit';
      });
      const projects = await repository.getProjects('en');

      expect(projects.filter((p) => p.slug === 'lint-kit')).toHaveLength(1);
      expect(projects.find((p) => p.slug === 'lint-kit')?.order).toBe(40);
      expect(logger.warnings.map((entry) => entry.event)).toContain('duplicate-slug');
    });
  });
}
