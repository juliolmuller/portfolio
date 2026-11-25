import {
  createMemoryGroqFetch,
  createSanityMemoryDataset,
} from '../../../../tests/support/sanity-memory';
import { sampleSkills } from '../../../../tests/support/skill-documents';
import { createRepository } from '../create-repository';
import { createFixtureDataset } from '../fixtures/dataset';
import { createFixtureSource } from '../fixtures/source';
import { type ContentRepository } from '../repository';
import { describeRepositoryContract } from '../repository.contract';
import { contentLocales } from '../schema';
import { contentTags } from '../tags';
import { createSanitySource } from './source';

describeRepositoryContract('sanity (GROQ over an in-memory dataset)', (dataset, logger) =>
  createRepository(
    createSanitySource(createMemoryGroqFetch(createSanityMemoryDataset(dataset))),
    logger,
  ),
);

describe('sanity adapter', () => {
  it('returns exactly what the fixtures adapter returns', async () => {
    const dataset = createFixtureDataset();

    dataset.skill.push(...sampleSkills());

    const fixtures = createRepository(createFixtureSource(dataset));
    const sanity = createRepository(
      createSanitySource(createMemoryGroqFetch(createSanityMemoryDataset(dataset))),
    );

    const read = async (repository: ContentRepository): Promise<unknown[]> => {
      const results: unknown[] = [
        await repository.getResume(),
        await repository.getProjectRoutes(),
        await repository.getProject('en', 'paybridge'),
      ];
      for (const locale of contentLocales) {
        results.push(
          await repository.getProfile(locale),
          await repository.getContact(locale),
          await repository.getFeaturedLinks(locale),
          await repository.getRecommendedProfiles(locale),
          await repository.getProjects(locale),
          await repository.getProject(locale, 'orbit-dashboard'),
          await repository.getExperience(locale),
          await repository.getEducation(locale),
          await repository.getTechnologies(locale),
          await repository.getPractices(locale),
          await repository.getSkills(locale),
        );
      }

      return results;
    };

    expect(await read(sanity)).toEqual(await read(fixtures));
  });

  it('tags every read for revalidation', async () => {
    const seen: Array<readonly string[]> = [];
    const repository = createRepository(
      createSanitySource(
        createMemoryGroqFetch(createSanityMemoryDataset(createFixtureDataset()), (_query, tags) =>
          seen.push(tags),
        ),
      ),
    );

    await repository.getProjects('en');
    await repository.getProject('en', 'orbit-dashboard');
    await repository.getExperience('en');
    await repository.getEducation('en');
    await repository.getSkills('en');
    expect(seen).toEqual([
      [contentTags.projects, contentTags.technologies, contentTags.skills],
      [
        contentTags.projects,
        'content:project:orbit-dashboard',
        contentTags.technologies,
        contentTags.skills,
      ],
      [contentTags.experience, contentTags.technologies, contentTags.skills],
      [contentTags.education, contentTags.skills],
      [contentTags.skills],
    ]);
  });
});
