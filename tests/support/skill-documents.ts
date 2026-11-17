import { FIXTURE_UPDATED_AT } from '@/lib/content/fixtures/helpers';
import { fixtureId } from '@/lib/content/fixtures/ids';
import { type SkillInput } from '@/lib/content/schema';

/**
 * Skills shared by the contract and parity tests (the fixture dataset has none
 * yet). The Portuguese names never render.
 */
export function sampleSkills(): SkillInput[] {
  return [
    {
      id: fixtureId('skill', 'Sample React'),
      isFixture: true,
      updatedAt: FIXTURE_UPDATED_AT,
      name: { en: 'React', pt: 'React' },
      categories: ['frontend'],
      iconSource: 'simple-icons',
      iconSlug: 'react',
      showInCloud: true,
      priority: 1,
      order: 10,
    },
    {
      id: fixtureId('skill', 'Sample code review'),
      isFixture: true,
      updatedAt: FIXTURE_UPDATED_AT,
      name: { en: 'Code review', pt: 'Revisão de código' },
      categories: ['engineering'],
      showInCloud: true,
      url: 'https://example.com/code-review',
      order: 20,
    },
    {
      id: fixtureId('skill', 'Sample hidden'),
      isFixture: true,
      updatedAt: FIXTURE_UPDATED_AT,
      name: { en: 'Hidden skill', pt: 'Habilidade oculta' },
      categories: ['backend', 'engineering'],
      visible: false,
      order: 5,
    },
  ];
}
