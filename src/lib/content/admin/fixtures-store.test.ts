import { createFixtureDataset } from '../fixtures/dataset';
import { L, meta } from '../fixtures/helpers';
import { documentSchemas } from '../schema';
import { createFixturesAdminStore } from './fixtures-store';

describe('fixtures admin store', () => {
  it('stores skills like any other collection', async () => {
    const store = createFixturesAdminStore(createFixtureDataset(), {
      readOnlyReason: 'test',
      writable: true,
    });
    const skill = documentSchemas.skill.parse({
      ...meta('skill', 'store-round-trip'),
      order: 10,
      name: L('Testing', 'Testes'),
      categories: ['engineering'],
    });

    await expect(store.write('skill', skill, { isNew: true })).resolves.toMatchObject({ ok: true });
    expect((await store.list('skill')).map((doc) => doc.id)).toContain(skill.id);
    await expect(store.get('skill', skill.id)).resolves.toMatchObject({
      categories: ['engineering'],
    });
    await expect(store.remove('skill', skill.id)).resolves.toMatchObject({ ok: true });
    expect((await store.list('skill')).map((doc) => doc.id)).not.toContain(skill.id);
  });

  it('lists documents by order, like the Sanity admin query', async () => {
    const store = createFixturesAdminStore(createFixtureDataset(), {
      readOnlyReason: 'test',
      writable: true,
    });
    const [first, second] = (await store.list('practice')).map((doc) => doc.id);

    if (!first || !second) throw new Error('Expected at least two practices');

    await store.patch('practice', first, { order: 999_990 });
    await store.patch('practice', second, { order: 999_980 });

    const ids = (await store.list('practice')).map((doc) => doc.id);

    expect(ids.slice(-2)).toEqual([second, first]);
  });
});
