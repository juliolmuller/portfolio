import { type DocumentInput } from '../../schema';
import { fixtureAvatar, L, meta } from '../helpers';

export const featuredLinks: Array<DocumentInput<'featuredLink'>> = [
  {
    ...meta('featuredLink', 'github'),
    label: L('GitHub', 'GitHub'),
    url: 'https://example.com/github',
    kind: 'social',
    icon: 'simple-icons:github',
    placements: ['header', 'footer'],
    isOwnProfile: true,
    order: 10,
    visible: true,
  },
  {
    ...meta('featuredLink', 'linkedin'),
    label: L('LinkedIn', 'LinkedIn'),
    url: 'https://example.com/linkedin',
    kind: 'social',
    icon: 'devicon:linkedin',
    placements: ['header', 'contact'],
    isOwnProfile: true,
    order: 20,
    visible: true,
  },
  {
    ...meta('featuredLink', 'talks'),
    label: L('Talks and slides', 'Palestras e slides'),
    url: 'https://example.com/talks',
    kind: 'site',
    icon: 'lucide:presentation',
    placements: ['contact', 'footer'],
    isOwnProfile: false,
    order: 30,
    visible: true,
  },
  {
    ...meta('featuredLink', 'old-notes'),
    label: L('Old notes', 'Notas antigas'),
    url: 'https://example.com/old-notes',
    kind: 'other',
    icon: 'lucide:rss',
    placements: ['footer'],
    isOwnProfile: false,
    order: 40,
    visible: false,
  },
];

export const recommendedProfiles: Array<DocumentInput<'recommendedProfile'>> = [
  {
    ...meta('recommendedProfile', 'ada-sample'),
    name: 'Ada Sample',
    role: L('Staff Engineer', 'Staff Engineer'),
    note: L(
      'Writes the clearest explanations of distributed systems I know. Her posts on retries changed how I design queues.',
      'Escreve as explicações mais claras sobre sistemas distribuídos que conheço. Os textos dela sobre retries mudaram como projeto filas.',
    ),
    avatar: fixtureAvatar('avatar-ada-sample'),
    url: 'https://example.com/ada-sample',
    order: 10,
    visible: true,
  },
  {
    ...meta('recommendedProfile', 'marco-placeholder'),
    name: 'Marco Placeholder',
    role: L('Product Designer', 'Product Designer'),
    note: L(
      'Turns vague briefs into flows that engineers can build in a week. Follow him for practical critiques of real interfaces.',
      'Transforma briefings vagos em fluxos que o time constrói em uma semana. Vale seguir pelas críticas práticas de interfaces reais.',
    ),
    avatar: fixtureAvatar('avatar-marco-placeholder'),
    url: 'https://example.com/marco-placeholder',
    order: 20,
    visible: true,
  },
  {
    ...meta('recommendedProfile', 'lin-example'),
    name: 'Lin Example',
    role: L('Developer Advocate', 'Developer Advocate'),
    note: L(
      'Short, honest videos about web performance. Every one of them ends with something you can try that afternoon.',
      'Vídeos curtos e honestos sobre performance web. Todos terminam com algo que dá para testar na mesma tarde.',
    ),
    avatar: fixtureAvatar('avatar-lin-example'),
    url: 'https://example.com/lin-example',
    order: 30,
    visible: true,
  },
  {
    ...meta('recommendedProfile', 'sofia-demo'),
    name: 'Sofia Demo',
    role: L('Data Engineer', 'Engenheira de Dados'),
    note: L(
      'Pragmatic notes on data pipelines and the tests that keep them honest.',
      'Notas pragmáticas sobre pipelines de dados e os testes que os mantêm confiáveis.',
    ),
    avatar: fixtureAvatar('avatar-sofia-demo'),
    url: 'https://example.com/sofia-demo',
    order: 40,
    visible: false,
  },
];
