import { createFixtureDataset } from '../fixtures/dataset';
import { parseDocument } from '../pipeline';
import { createFixturesAdminStore } from './fixtures-store';

describe('fixtures admin store', () => {
  it('lists no skills until fixture skills exist', async () => {
    const store = createFixturesAdminStore(createFixtureDataset(), {
      readOnlyReason: 'test',
      writable: true,
    });

    await expect(store.list('skill')).resolves.toEqual([]);
  });

  it('accepts a skill without an icon when GROQ returns nulls', () => {
    const parsed = parseDocument('skill', {
      id: 'skill.7a1d9e20-4c3b-5a6f-8d21-0b9c8d7e6f5a',
      updatedAt: '2026-10-01T12:00:00Z',
      name: { en: 'Testing', pt: 'Testes' },
      categories: ['engineering'],
      iconSource: null,
      iconSlug: null,
      customSvg: null,
      monogram: null,
      brandColor: null,
      url: null,
      showInCloud: false,
      priority: 2,
      order: 0,
      visible: true,
    });

    expect(parsed).toMatchObject({ categories: ['engineering'], showInCloud: false });
  });
});
