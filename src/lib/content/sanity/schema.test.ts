import { schemaTypes } from '../../../../sanity/schema';
import { createFixtureDataset } from '../fixtures/dataset';
import { L, meta } from '../fixtures/helpers';
import { type SkillInput } from '../schema';
import { toSanityDocument, toSanityDocuments } from './documents';

interface Field {
  fields?: Field[];
  name: string;
  of?: Field[];
  type: string;
}

const skillAssets = { image: (): string => 'asset', file: (): string => 'asset' };
const registry = new Map(schemaTypes.map((type) => [type.name, type as unknown as Field]));
const builtIn: Record<string, string[]> = {
  image: ['asset', 'hotspot', 'crop'],
  file: ['asset'],
  slug: ['current'],
  reference: ['_ref'],
};

function check(value: unknown, field: Field, at: string, errors: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item: unknown, index) => {
      const itemType =
        item && typeof item === 'object' && '_type' in item ? String(item._type) : undefined;
      const member = field.of?.find((candidate) => candidate.type === itemType) ?? field.of?.[0];

      if (!member) errors.push(`${at}: array without members`);
      else check(item, { ...member, name: `${index}` }, `${at}[${index}]`, errors);
    });

    return;
  }

  if (!value || typeof value !== 'object') return;

  const named = registry.get(field.type);
  const fields = named?.fields ?? field.fields ?? [];
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith('_') || builtIn[field.type]?.includes(key)) continue;

    const child = fields.find((candidate) => candidate.name === key);

    if (!child) errors.push(`${at}.${key}: not in the Studio schema`);
    else check(entry, child, `${at}.${key}`, errors);
  }
}

describe('sanity/schema.ts', () => {
  it('declares every field the seed writes', () => {
    const errors: string[] = [];
    const documents = toSanityDocuments(createFixtureDataset(), {
      image: () => 'image-asset',
      file: () => 'file-asset',
    });
    for (const document of documents) {
      const type = registry.get(document._type);

      if (!type) errors.push(`${document._type}: no document type`);
      else check(document, type, document._type, errors);
    }
    expect(errors).toEqual([]);
  });

  it('declares the icon fields of every icon source a skill can use', () => {
    const sources: Array<[string, Partial<SkillInput>]> = [
      ['simple-icons', { iconSource: 'simple-icons', iconSlug: 'typescript' }],
      ['devicon', { iconSource: 'devicon', iconSlug: 'react' }],
      ['monogram', { iconSource: 'monogram', monogram: 'CA' }],
    ];
    const type = registry.get('skill');
    const errors: string[] = [];

    if (!type) throw new Error('skill is not in the Studio schema');

    for (const [name, icon] of sources) {
      const stored = toSanityDocument(
        'skill',
        {
          ...meta('skill', `icon-${name}`),
          order: 0,
          name: L('Skill', 'Habilidade'),
          categories: ['language'],
          ...icon,
        },
        skillAssets,
      );

      check(stored, type, name, errors);
      expect(stored, name).toMatchObject(icon);
    }
    expect(errors).toEqual([]);
  });

  it('declares every field a skill writes', () => {
    const full = toSanityDocument(
      'skill',
      {
        ...meta('skill', 'clean-architecture'),
        order: 0,
        name: L('Clean Architecture', 'Arquitetura limpa'),
        categories: ['engineering', 'backend'],
        iconSource: 'custom-svg',
        customSvg: { viewBox: '0 0 24 24', paths: ['M0 0h24v24H0z'] },
        brandColor: '#ff0000',
        url: 'https://example.com/clean',
        showInCloud: true,
        priority: 1,
      },
      skillAssets,
    );
    const minimal = toSanityDocument(
      'skill',
      {
        ...meta('skill', 'testing'),
        order: 0,
        name: L('Testing', 'Testes'),
        categories: ['engineering'],
      },
      skillAssets,
    );
    const type = registry.get('skill');
    const errors: string[] = [];

    if (!type) throw new Error('skill is not in the Studio schema');

    check(full, type, 'full', errors);
    check(minimal, type, 'minimal', errors);
    expect(errors).toEqual([]);
    expect(full['name']).toMatchObject({ _type: 'localeString' });
    expect(full['customSvg']).toMatchObject({ _type: 'svgData' });
    expect(minimal).not.toHaveProperty('iconSource');
    expect(minimal).not.toHaveProperty('customSvg');
    expect(minimal).toMatchObject({ showInCloud: false, priority: 2, visible: true });
  });

  it('has unique type names', () => {
    expect(registry.size).toBe(schemaTypes.length);
  });
});
