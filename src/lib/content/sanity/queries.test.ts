import {
  createMemoryGroqFetch,
  createSanityMemoryDataset,
} from '../../../../tests/support/sanity-memory';
import { createFixtureDataset } from '../fixtures/dataset';
import { L, meta } from '../fixtures/helpers';
import { parseDocument } from '../pipeline';
import { documentSchemas, type SkillInput } from '../schema';
import { adminGetQuery, adminListQuery } from './queries';

const full: SkillInput = {
  ...meta('skill', 'clean-architecture'),
  order: 20,
  name: L('Clean Architecture', 'Arquitetura limpa'),
  categories: ['engineering', 'backend'],
  iconSource: 'custom-svg',
  customSvg: { viewBox: '0 0 24 24', paths: ['M0 0h24v24H0z'] },
  brandColor: '#ff0000',
  url: 'https://example.com/clean',
  showInCloud: true,
  priority: 1,
};

const minimal: SkillInput = {
  ...meta('skill', 'testing'),
  order: 10,
  name: L('Testing', 'Testes'),
  categories: ['engineering'],
};

const fetchGroq = createMemoryGroqFetch(
  createSanityMemoryDataset({ ...createFixtureDataset(), skill: [full, minimal] }),
);

describe('admin skill projection', () => {
  it.each([
    ['a full skill', full],
    ['a skill without an icon', minimal],
  ])('reads %s back as the contract document', async (_name, skill) => {
    const row = await fetchGroq(adminGetQuery('skill'), { id: skill.id }, []);

    expect(parseDocument('skill', row)).toEqual(documentSchemas.skill.parse(skill));
  });

  it('projects absent icon fields as GROQ nulls that the pipeline accepts', async () => {
    const row = await fetchGroq(adminGetQuery('skill'), { id: minimal.id }, []);

    expect(row).toMatchObject({
      iconSource: null,
      iconSlug: null,
      customSvg: null,
      monogram: null,
      brandColor: null,
      url: null,
      showInCloud: false,
      priority: 2,
    });
    expect(parseDocument('skill', row)).not.toBeNull();
  });

  it('lists every skill by order', async () => {
    const rows = (await fetchGroq(adminListQuery('skill'), {}, [])) as Array<{ id: string }>;

    expect(rows.map((row) => row.id)).toEqual([minimal.id, full.id]);
    expect(rows.map((row) => parseDocument('skill', row))).toEqual([
      documentSchemas.skill.parse(minimal),
      documentSchemas.skill.parse(full),
    ]);
  });
});
