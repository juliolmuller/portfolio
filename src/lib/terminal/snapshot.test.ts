import { describe, expect, it } from 'vitest';

import { type AppLocale } from '@/i18n/routing';
import { createRepository } from '@/lib/content/create-repository';
import { createFixtureDataset } from '@/lib/content/fixtures/dataset';
import { techId } from '@/lib/content/fixtures/ids';
import { createFixtureSource } from '@/lib/content/fixtures/source';
import { skillIdFor } from '@/lib/content/migrations/skills';

import { buildSnapshot, type ContentSnapshot } from './snapshot';
import { fixtureSnapshot, snapshotSourceOf } from './test-utils';

async function snapshotWith(
  dataset: ReturnType<typeof createFixtureDataset>,
  locale: AppLocale,
): Promise<ContentSnapshot> {
  const repository = createRepository(createFixtureSource(dataset), { warn: () => {} });

  return buildSnapshot(await snapshotSourceOf(repository, locale));
}

describe.each(['en', 'pt'] as const)('snapshot (%s)', (locale) => {
  it('contains only public, visible, localized content', async () => {
    const snapshot = await fixtureSnapshot(locale);

    expect(snapshot.locale).toBe(locale);

    const slugs = snapshot.projects.map((project) => project.slug);

    expect(slugs).toContain('orbit-dashboard');
    expect(slugs).not.toContain('scratch-pad');
    expect(snapshot.recommended.map((p) => p.name)).not.toContain('Sofia Demo');
    expect(snapshot.contact).toEqual({
      user: 'hello',
      domain: 'example.com',
      bookingUrl: 'https://example.com/book',
    });
    expect(snapshot.resume).toEqual({ en: true, pt: true });
  });

  it('carries no phone numbers, icons or file URLs', async () => {
    const repository = createRepository(createFixtureSource(), {
      warn: () => {},
    });
    const source = await snapshotSourceOf(repository, locale);
    const snapshot = buildSnapshot({
      ...source,
      contact: source.contact && { ...source.contact, phone: '+55 41 99999-0000' },
    });
    const json = JSON.stringify(snapshot);

    expect(json).not.toContain('99999');
    expect(json).not.toContain('phone');
    expect(json).not.toContain('/fixtures/');
    expect(json).not.toContain('viewBox');
  });

  it('includes visible skills with name and categories only', async () => {
    const repository = createRepository(createFixtureSource(), { warn: () => {} });
    const snapshot = await fixtureSnapshot(locale);

    expect(snapshot.skills.length).toBeGreaterThan(0);
    expect(snapshot.skills).toHaveLength((await repository.getSkills(locale)).length);

    for (const skill of snapshot.skills) {
      expect(Object.keys(skill).sort()).toEqual(['categories', 'name']);
      expect(skill.categories.length).toBeGreaterThanOrEqual(1);
    }
  });

  // The legacy `technologies` catalog is a separate collection that the stack
  // commands still read, so it is deliberately not asserted here.
  it('drops a hidden skill from skills and from project and experience technologies', async () => {
    const react = skillIdFor(techId('React'));
    const visibleRepository = createRepository(createFixtureSource(), { warn: () => {} });
    const hiddenName = (await visibleRepository.getSkills(locale)).find(
      (skill) => skill.id === react,
    )?.name;
    const dataset = createFixtureDataset();

    for (const skill of dataset.skill) {
      if (skill.id === react) skill.visible = false;
    }

    const snapshot = await snapshotWith(dataset, locale);
    const orbit = snapshot.projects.find((project) => project.slug === 'orbit-dashboard');

    expect(hiddenName).toBeTruthy();
    expect(snapshot.skills.map((skill) => skill.name)).not.toContain(hiddenName);
    expect(orbit?.technologies.length).toBeGreaterThan(0);
    expect(orbit?.technologies).not.toContain(hiddenName);

    for (const entry of snapshot.experience) {
      expect(entry.technologies).not.toContain(hiddenName);
    }
  });

  it('names project and experience technologies from skillIds', async () => {
    const repository = createRepository(createFixtureSource(), { warn: () => {} });
    const snapshot = await fixtureSnapshot(locale);
    const skillNames = new Map((await repository.getSkills(locale)).map((s) => [s.id, s.name]));
    const technologyNames = new Map(
      (await repository.getTechnologies(locale)).map((t) => [t.id, t.name]),
    );
    const projects = await repository.getProjects(locale);
    const experience = await repository.getExperience(locale);

    for (const project of projects) {
      expect(snapshot.projects.find((p) => p.slug === project.slug)?.technologies).toEqual(
        project.skillIds.map((id) => skillNames.get(id)),
      );
    }

    for (const entry of experience) {
      expect(snapshot.experience.find((e) => e.slug === entry.slug)?.technologies).toEqual(
        entry.skillIds.map((id) => skillNames.get(id)),
      );
    }

    const orbit = projects.find((project) => project.slug === 'orbit-dashboard');

    expect(snapshot.projects.find((p) => p.slug === 'orbit-dashboard')?.technologies).toEqual(
      orbit?.techIds.map((id) => technologyNames.get(id)),
    );
  });
});
