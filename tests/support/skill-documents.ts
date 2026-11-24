import { L, meta } from '@/lib/content/fixtures/helpers';
import { type SkillInput } from '@/lib/content/schema';

/**
 * Three fictional skills (one hidden) shared by the contract and parity tests,
 * since the fixture dataset has none until #59.
 */
export function sampleSkills(): SkillInput[] {
  return [
    {
      ...meta('skill', 'Sample React'),
      name: L('React', 'React'),
      categories: ['frontend'],
      iconSource: 'simple-icons',
      iconSlug: 'react',
      showInCloud: true,
      priority: 1,
      order: 10,
    },
    {
      ...meta('skill', 'Sample code review'),
      name: L('Code review', 'Revisão de código'),
      categories: ['engineering'],
      showInCloud: true,
      url: 'https://example.com/code-review',
      order: 20,
    },
    {
      ...meta('skill', 'Sample hidden'),
      name: L('Hidden skill', 'Habilidade oculta'),
      categories: ['backend', 'engineering'],
      visible: false,
      order: 5,
    },
  ];
}
