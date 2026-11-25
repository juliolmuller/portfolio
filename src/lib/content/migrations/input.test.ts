import {
  createMemoryGroqFetch,
  createSanityMemoryDataset,
} from '../../../../tests/support/sanity-memory';
import { createFixtureDataset } from '../fixtures/dataset';
import { type SanityDocument } from '../sanity/documents';
import { loadSkillCopyInput } from './input';
import { planSkillCopy } from './plan';

vi.mock('server-only', () => ({}));

function preCopyDocuments(): SanityDocument[] {
  return createSanityMemoryDataset(createFixtureDataset())
    .filter((doc) => doc._type !== 'skill')
    .map((doc) => {
      const { skills: _skills, ...rest } = doc as { skills?: unknown } & SanityDocument;

      return rest as SanityDocument;
    });
}

function runnerFor(documents: SanityDocument[]): (query: string) => Promise<unknown> {
  const fetch = createMemoryGroqFetch(documents);

  return (query) => fetch(query, {}, []);
}

describe('loadSkillCopyInput', () => {
  it('loads a dataset without skills and plans every copy', async () => {
    const { input, skipped } = await loadSkillCopyInput(runnerFor(preCopyDocuments()));

    expect(skipped).toEqual([]);
    expect(input.skills).toEqual([]);
    expect(input.technologies.length + input.practices.length).toBe(112);
    expect(input.projects).toHaveLength(7);
    expect(input.experience).toHaveLength(3);
    expect(input.projects.every((owner) => owner.skillIds.length === 0)).toBe(true);
    expect(planSkillCopy(input, '2026-11-17T12:00:00Z').create).toHaveLength(112);
  });

  it('keeps an owner whose unrelated field is invalid', async () => {
    const documents = preCopyDocuments().map((doc) =>
      doc._type === 'project' ? { ...doc, year: 'not a year' } : doc,
    ) as SanityDocument[];
    const { input, skipped } = await loadSkillCopyInput(runnerFor(documents));

    expect(input.projects).toHaveLength(7);
    expect(skipped).toEqual([]);
  });

  it('reports an invalid technology by id and field paths only', async () => {
    let target = '';
    const documents = preCopyDocuments().map((doc) => {
      if (doc._type !== 'technology' || target) return doc;

      target = doc._id;

      return { ...doc, name: 'secret value'.repeat(20) };
    }) as SanityDocument[];
    const { input, skipped } = await loadSkillCopyInput(runnerFor(documents));

    expect(skipped).toEqual([{ type: 'technology', id: target, paths: ['name'] }]);
    expect(JSON.stringify(skipped)).not.toContain('secret value');
    expect(input.technologies).toHaveLength(95);
  });
});
