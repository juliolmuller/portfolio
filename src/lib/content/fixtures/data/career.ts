import { type DocumentInput } from '../../schema';
import { L, meta } from '../helpers';
import { techId } from '../ids';

export const experience: Array<DocumentInput<'experience'>> = [
  {
    ...meta('experience', 'lumen-works'),
    company: 'Lumen Works',
    companyUrl: 'https://example.com/lumen-works',
    roles: [
      {
        title: L('Senior Full Stack Engineer', 'Engenheiro Full Stack Sênior'),
        start: '2023-03',
        summary: L(
          'I lead the web platform of a fictional scheduling product, from the database schema to the design system. The team is spread across four time zones, so most decisions happen in writing: short proposals, a weekly architecture review and a changelog that product and support actually read. I split my time between hands-on work on the hardest parts of the stack, pairing with newer engineers and keeping the delivery pipeline fast enough that shipping small changes stays the default rather than the exception.',
          'Lidero a plataforma web de um produto fictício de agendamentos, do schema do banco ao design system. O time está espalhado por quatro fusos horários, então a maior parte das decisões acontece por escrito: propostas curtas, uma revisão de arquitetura semanal e um changelog que produto e suporte realmente leem. Divido meu tempo entre colocar a mão nas partes mais difíceis da stack, fazer pair com quem está chegando e manter o pipeline de entrega rápido o bastante para que publicar mudanças pequenas continue sendo o padrão, não a exceção.',
        ),
        bullets: [
          L(
            'Cut the median page load from 3.1 s to 1.2 s by moving reports to server rendering.',
            'Reduzi o carregamento mediano das páginas de 3,1 s para 1,2 s levando os relatórios para renderização no servidor.',
          ),
          L(
            'Designed the public API now used by 30 partner integrations.',
            'Projetei a API pública usada hoje por 30 integrações de parceiros.',
          ),
          L(
            'Mentored four engineers through their first on-call rotation.',
            'Fui mentor de quatro pessoas no primeiro plantão de cada uma.',
          ),
        ],
      },
    ],
    techIds: ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'].map(
      techId,
    ),
    collapsedByDefault: false,
    order: 10,
    visible: true,
  },
  {
    ...meta('experience', 'northbridge-labs'),
    company: 'Northbridge Labs',
    companyUrl: 'https://example.com/northbridge-labs',
    location: L('Curitiba, Brazil (hybrid)', 'Curitiba, Brasil (híbrido)'),
    roles: [
      {
        title: L('Lead Frontend Engineer', 'Líder de Frontend'),
        start: '2020-02',
        end: '2023-02',
        summary: L(
          'I led a team of five building the customer portal of a fictional logistics company.',
          'Liderei um time de cinco pessoas no portal de clientes de uma empresa fictícia de logística.',
        ),
        bullets: [
          L(
            'Shipped a shared component library adopted by three product teams.',
            'Entreguei uma biblioteca de componentes compartilhada, adotada por três times de produto.',
          ),
          L(
            'Raised automated test coverage of the portal from 35% to 82%.',
            'Aumentei a cobertura de testes automatizados do portal de 35% para 82%.',
          ),
        ],
      },
    ],
    techIds: ['TypeScript', 'Vue.js', 'Nuxt', 'GraphQL', 'Google Cloud'].map(techId),
    collapsedByDefault: false,
    order: 20,
    visible: true,
  },
  {
    ...meta('experience', 'fable-and-co'),
    company: 'Fable & Co.',
    companyUrl: 'https://example.com/fable-and-co',
    location: L('Curitiba, Brazil', 'Curitiba, Brasil'),
    roles: [
      {
        title: L('Software Engineer', 'Engenheiro de Software'),
        start: '2016-06',
        end: '2020-01',
        summary: L(
          'I built internal tools and integrations for the back office of a fictional retail group.',
          'Desenvolvi ferramentas internas e integrações para o back office de um grupo varejista fictício.',
        ),
        bullets: [
          L(
            'Automated a monthly reconciliation that used to take two people a full week.',
            'Automatizei uma conciliação mensal que ocupava duas pessoas por uma semana inteira.',
          ),
          L(
            'Migrated 12 legacy reports from spreadsheets to a single SQL data mart.',
            'Migrei 12 relatórios legados de planilhas para um único data mart em SQL.',
          ),
        ],
      },
    ],
    techIds: ['JavaScript', 'PHP', 'SQL', 'AngularJS', 'VBA'].map(techId),
    collapsedByDefault: true,
    order: 30,
    visible: true,
  },
];

export const education: Array<DocumentInput<'education'>> = [
  {
    ...meta('education', 'bsc-computer-science'),
    kind: 'degree',
    title: L('B.Sc. in Computer Science', 'Bacharelado em Ciência da Computação'),
    institution: 'Example University',
    start: '2012',
    end: '2016',
    url: 'https://example.com/university',
    order: 10,
    visible: true,
  },
  {
    ...meta('education', 'applied-software-architecture'),
    kind: 'certification',
    title: L('Applied Software Architecture', 'Arquitetura de Software Aplicada'),
    institution: 'Example Academy',
    end: '2021',
    url: 'https://example.com/academy/architecture',
    order: 20,
    visible: true,
  },
  {
    ...meta('education', 'accessible-interfaces'),
    kind: 'certification',
    title: L('Accessible Interface Engineering', 'Engenharia de Interfaces Acessíveis'),
    institution: 'Example Academy',
    end: '2022',
    url: 'https://example.com/academy/accessibility',
    order: 30,
    visible: true,
  },
];
