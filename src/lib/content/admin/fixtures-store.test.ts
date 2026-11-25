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

  it('lists documents by order, then id, like the Sanity query', async () => {
    const store = createFixturesAdminStore(createFixtureDataset(), {
      readOnlyReason: 'test',
      writable: true,
    });
    const make = (slug: string, order: number): ReturnType<typeof documentSchemas.skill.parse> =>
      documentSchemas.skill.parse({
        ...meta('skill', slug),
        order,
        name: L(slug, slug),
        categories: ['engineering'],
      });
    const late = make('list-late', 30);
    const early = make('list-early', 10);

    await store.write('skill', late, { isNew: true });
    await store.write('skill', early, { isNew: true });
    expect((await store.list('skill')).map((doc) => doc.id)).toEqual([early.id, late.id]);

    await store.patch('skill', late.id, { order: 5 });
    expect((await store.list('skill')).map((doc) => doc.id)).toEqual([late.id, early.id]);
  });
});
