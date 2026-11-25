import { type DocumentInput } from '../../schema';
import { fixtureImage, L, meta } from '../helpers';
import { techId } from '../ids';
import { skillRef } from './skills';

const ORBIT_BODY_EN = `## Why this concept exists

Orbit Dashboard is a fictional analytics product I use to explore one question: how much can a dashboard explain on its own before someone has to ask an analyst? Most dashboards answer *what* happened. Very few help you understand *why*, and almost none tell you how much to trust the number on the screen.

## The problem with the usual approach

Teams usually start from charts. Someone picks a library, wires a few queries, and ships a wall of widgets. Six months later nobody remembers which chart counts refunds, which one is in UTC and which one silently drops late events. The interface looks finished, but the meaning is gone.

I wanted the opposite: start from definitions. Every metric in Orbit is a small, versioned document with a name, a formula, an owner and a freshness budget. Charts are just one way to render that document.

## How it is built

- **Metric registry.** Definitions live in PostgreSQL next to the data they describe, so a migration that changes a column also has to update the metric that depends on it.
- **Query layer.** A thin TypeScript service compiles definitions into SQL with explicit time zones and explicit handling of late data. Results are cached in Redis with keys derived from the definition version, so a change to a formula can never serve a stale answer.
- **Interface.** The frontend is a Next.js app rendered on the server. Each panel shows the value, the comparison period, the freshness of the data and a one-line plain-language definition.

## Design decisions worth sharing

### Freshness is part of the value

A number without a timestamp is a rumor. Every panel shows when its data was last complete, and panels fade to a warning state when they exceed their freshness budget. This one change removed most of the "is this broken?" messages in the concept's test sessions.

### Comparisons are opinionated

Instead of letting every viewer pick any date range, each metric declares its natural comparison: week over week for traffic, month over month for revenue, cohort against cohort for retention. Fewer knobs, fewer wrong conclusions.

### Drill-downs never leave the context

Clicking a value opens a side panel with the breakdown and the exact query parameters, instead of navigating away. People can share a link to that precise state, which turns screenshots in chat into reproducible questions.

## What I would do next

The next experiment is annotations written by the system itself: when a metric moves beyond its usual band, the dashboard would list the deploys, incidents and campaigns that happened in the same window. The goal is not to replace analysts, but to give them better first questions.

## Notes

This is a design and engineering concept with invented data. The numbers, users and test sessions described here are fictional and exist only to show how I approach a problem like this.`;

const ORBIT_BODY_PT = `## Por que este conceito existe

O Orbit Dashboard é um produto fictício de analytics que uso para explorar uma pergunta: quanto um dashboard consegue explicar sozinho antes que alguém precise chamar um analista? A maioria dos dashboards responde *o que* aconteceu. Pouquíssimos ajudam a entender *por quê*, e quase nenhum diz o quanto dá para confiar no número que está na tela.

## O problema da abordagem de sempre

Os times costumam começar pelos gráficos. Alguém escolhe uma biblioteca, liga algumas queries e publica um mural de widgets. Seis meses depois, ninguém lembra qual gráfico conta estornos, qual está em UTC e qual descarta eventos atrasados sem avisar. A interface parece pronta, mas o significado se perdeu.

Eu queria o contrário: começar pelas definições. Cada métrica do Orbit é um pequeno documento versionado, com nome, fórmula, responsável e um limite de atualização. O gráfico é só uma das formas de exibir esse documento.

## Como foi construído

- **Registro de métricas.** As definições ficam no PostgreSQL, ao lado dos dados que descrevem. Assim, uma migration que altera uma coluna também precisa atualizar a métrica que depende dela.
- **Camada de consulta.** Um serviço enxuto em TypeScript compila as definições em SQL com fuso horário explícito e tratamento explícito de dados atrasados. Os resultados ficam em cache no Redis, com chaves derivadas da versão da definição, então uma mudança de fórmula nunca entrega uma resposta desatualizada.
- **Interface.** O frontend é um app Next.js renderizado no servidor. Cada painel mostra o valor, o período de comparação, a atualização dos dados e uma definição de uma linha em linguagem simples.

## Decisões de design que valem a pena

### A atualização faz parte do valor

Número sem data é boato. Cada painel mostra quando seus dados ficaram completos pela última vez e entra em estado de alerta quando passa do limite de atualização. Só essa mudança eliminou a maior parte das mensagens de "isso quebrou?" nas sessões de teste do conceito.

### As comparações têm opinião

Em vez de deixar cada pessoa escolher qualquer intervalo de datas, cada métrica declara sua comparação natural: semana contra semana para tráfego, mês contra mês para receita, coorte contra coorte para retenção. Menos botões, menos conclusões erradas.

### O detalhamento nunca tira você do contexto

Clicar em um valor abre um painel lateral com a quebra dos dados e os parâmetros exatos da consulta, sem trocar de página. Dá para compartilhar um link para esse estado preciso, o que transforma prints no chat em perguntas reproduzíveis.

## O que eu faria em seguida

O próximo experimento são anotações escritas pelo próprio sistema: quando uma métrica sai da faixa habitual, o dashboard listaria os deploys, incidentes e campanhas que aconteceram na mesma janela. A ideia não é substituir analistas, e sim dar a eles perguntas iniciais melhores.

## Observações

Este é um conceito de design e engenharia com dados inventados. Os números, as pessoas usuárias e as sessões de teste descritos aqui são fictícios e existem só para mostrar como eu abordo um problema desse tipo.`;

export const projects: Array<DocumentInput<'project'>> = [
  {
    ...meta('project', 'orbit-dashboard'),
    slug: 'orbit-dashboard',
    featured: true,
    visible: true,
    order: 10,
    year: 2025,
    kind: 'web',
    status: 'live',
    techIds: ['TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Redis'].map(techId),
    skillIds: ['TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Redis'].map(skillRef),
    cover: fixtureImage(
      'project-orbit-dashboard-cover',
      L(
        'Abstract cover art for Orbit Dashboard: violet and cyan light over a dark grid',
        'Arte de capa abstrata do Orbit Dashboard: luzes violeta e ciano sobre uma grade escura',
      ),
    ),
    gallery: [
      {
        ...fixtureImage(
          'project-orbit-dashboard-gallery-1',
          L(
            'Abstract illustration with soft green and blue light behind translucent panels',
            'Ilustração abstrata com luz verde e azul suave atrás de painéis translúcidos',
          ),
        ),
        caption: L(
          'Every panel pairs a value with its freshness.',
          'Cada painel mostra o valor junto com a atualização dos dados.',
        ),
      },
      {
        ...fixtureImage(
          'project-orbit-dashboard-gallery-2',
          L(
            'Abstract illustration with warm amber light and stacked panels',
            'Ilustração abstrata com luz âmbar quente e painéis sobrepostos',
          ),
        ),
        caption: L(
          'Drill-downs open beside the value instead of on a new page.',
          'O detalhamento abre ao lado do valor, sem trocar de página.',
        ),
      },
      {
        ...fixtureImage(
          'project-orbit-dashboard-gallery-3',
          L(
            'Abstract illustration with pink and violet light crossing a grid',
            'Ilustração abstrata com luz rosa e violeta atravessando uma grade',
          ),
        ),
        caption: L(
          'Metric definitions are versioned documents.',
          'As definições de métricas são documentos versionados.',
        ),
      },
    ],
    links: { live: 'https://example.com/orbit-dashboard' },
    title: L('Orbit Dashboard', 'Orbit Dashboard'),
    tagline: L(
      'An analytics dashboard that explains its own numbers.',
      'Um dashboard de analytics que explica os próprios números.',
    ),
    summary: L(
      'Analytics concept built from metric definitions first: every panel shows its formula, its comparison and how fresh the data is.',
      'Conceito de analytics que parte das definições de métricas: cada painel mostra a fórmula, a comparação e o quanto os dados estão atualizados.',
    ),
    role: L('Design and full stack development', 'Design e desenvolvimento full stack'),
    context: L(
      'Dashboards tend to answer what happened but rarely why, and almost never how much to trust a number. This fictional product explores the opposite starting point.',
      'Dashboards costumam responder o que aconteceu, raramente o porquê, e quase nunca o quanto dá para confiar em um número. Este produto fictício explora o ponto de partida oposto.',
    ),
    approach: L(
      'Metrics are versioned documents stored next to the data. A small TypeScript service compiles them into SQL, caches results by definition version and feeds a server-rendered interface.',
      'As métricas são documentos versionados guardados junto aos dados. Um pequeno serviço em TypeScript compila tudo em SQL, faz cache dos resultados pela versão da definição e alimenta uma interface renderizada no servidor.',
    ),
    highlights: [
      L(
        'Freshness shown on every panel, with a warning state past its budget',
        'Atualização visível em todos os painéis, com alerta quando passa do limite',
      ),
      L(
        'Cache keys derived from definition versions, so formulas never serve stale results',
        'Chaves de cache derivadas da versão da definição: fórmula nova nunca entrega resultado antigo',
      ),
      L(
        'Shareable drill-down links that reproduce the exact query',
        'Links de detalhamento compartilháveis que reproduzem a consulta exata',
      ),
      L(
        'Median panel render under 300 ms in the concept’s benchmark',
        'Renderização mediana dos painéis abaixo de 300 ms no benchmark do conceito',
      ),
    ],
    outcome: L(
      'In fictional test sessions, questions about broken numbers dropped by about two thirds.',
      'Nas sessões de teste fictícias, as perguntas sobre números quebrados caíram cerca de dois terços.',
    ),
    body: L(ORBIT_BODY_EN, ORBIT_BODY_PT),
  },
  {
    ...meta('project', 'pocket-ledger'),
    slug: 'pocket-ledger',
    featured: true,
    visible: true,
    order: 20,
    year: 2026,
    kind: 'mobile',
    status: 'in-progress',
    techIds: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'].map(techId),
    skillIds: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'].map(skillRef),
    cover: fixtureImage(
      'project-pocket-ledger-cover',
      L(
        'Abstract cover art for Pocket Ledger: green and blue light over a dark grid',
        'Arte de capa abstrata do Pocket Ledger: luzes verde e azul sobre uma grade escura',
      ),
    ),
    title: L('Pocket Ledger', 'Pocket Ledger'),
    tagline: L(
      'A personal finance app that works offline first.',
      'Um app de finanças pessoais que funciona primeiro offline.',
    ),
    summary: L(
      'Mobile finance concept that records expenses in two taps, syncs when a connection returns and never loses an entry.',
      'Conceito mobile de finanças que registra gastos em dois toques, sincroniza quando a conexão volta e nunca perde um lançamento.',
    ),
    role: L('Product design and development', 'Design de produto e desenvolvimento'),
    context: L(
      'Most budgeting apps assume a stable connection and a patient user. People log expenses in line at the bakery, often with poor signal.',
      'A maioria dos apps de orçamento pressupõe conexão estável e paciência. As pessoas registram gastos na fila da padaria, muitas vezes com sinal fraco.',
    ),
    approach: L(
      'Entries are written to local storage first and synced through an append-only log, so conflicts resolve deterministically on the server.',
      'Os lançamentos são gravados primeiro no armazenamento local e sincronizados por um log append-only, então os conflitos se resolvem de forma determinística no servidor.',
    ),
    highlights: [
      L(
        'Two-tap entry flow tested one-handed',
        'Lançamento em dois toques, testado com uma mão só',
      ),
      L(
        'Append-only sync log with deterministic conflict resolution',
        'Log de sincronização append-only com resolução de conflitos determinística',
      ),
      L(
        'Monthly summary readable by screen readers without charts',
        'Resumo mensal compreensível por leitores de tela, sem depender de gráficos',
      ),
    ],
    outcome: L(
      'Still in progress: the sync engine works, the budgeting views are next.',
      'Ainda em andamento: o motor de sincronização funciona e as telas de orçamento são as próximas.',
    ),
  },
  {
    ...meta('project', 'tidy-desk'),
    slug: 'tidy-desk',
    featured: false,
    visible: true,
    order: 50,
    year: 2021,
    kind: 'desktop',
    status: 'archived',
    techIds: ['TypeScript', 'Node.js', 'Go'].map(techId),
    skillIds: ['TypeScript', 'Node.js', 'Go'].map(skillRef),
    cover: fixtureImage(
      'project-tidy-desk-cover',
      L(
        'Abstract cover art for Tidy Desk: amber and pink light over a dark grid',
        'Arte de capa abstrata do Tidy Desk: luzes âmbar e rosa sobre uma grade escura',
      ),
    ),
    links: { repo: 'https://example.com/tidy-desk/source' },
    title: L('Tidy Desk', 'Tidy Desk'),
    tagline: L(
      'A cross-platform file organizer driven by plain rules.',
      'Um organizador de arquivos multiplataforma guiado por regras simples.',
    ),
    summary: L(
      'Desktop concept that sorts downloads and screenshots with readable rules, previews every move and can undo all of them.',
      'Conceito desktop que organiza downloads e capturas de tela com regras legíveis, mostra cada movimentação antes e permite desfazer tudo.',
    ),
    role: L('Solo developer', 'Desenvolvedor solo'),
    context: L(
      'Downloads folders grow without limit. Existing organizers either hide their logic or require scripting.',
      'A pasta de downloads cresce sem limite. Os organizadores existentes escondem a lógica ou exigem scripts.',
    ),
    approach: L(
      'Rules are written in a tiny, readable format and evaluated by a Go file watcher. The interface shows a dry run before anything moves.',
      'As regras são escritas em um formato pequeno e legível e avaliadas por um watcher de arquivos em Go. A interface mostra uma simulação antes de mover qualquer coisa.',
    ),
    highlights: [
      L('Dry run preview for every rule change', 'Simulação prévia a cada mudança de regra'),
      L(
        'Full undo history stored as a journal',
        'Histórico completo de desfazer guardado como journal',
      ),
      L(
        'Idle CPU usage below 1% while watching folders',
        'Uso de CPU abaixo de 1% em repouso enquanto observa as pastas',
      ),
    ],
    outcome: L(
      'Archived after the concept proved the rule format; the ideas moved into later automation work.',
      'Arquivado depois que o conceito validou o formato das regras; as ideias seguiram para projetos de automação posteriores.',
    ),
  },
  {
    ...meta('project', 'invoice-bot'),
    slug: 'invoice-bot',
    featured: false,
    visible: true,
    order: 60,
    year: 2022,
    kind: 'automation',
    status: 'private',
    techIds: ['Python', 'Excel / Power Query', 'SharePoint', 'Power BI'].map(techId),
    skillIds: ['Python', 'Excel / Power Query', 'SharePoint', 'Power BI'].map(skillRef),
    title: L('Invoice Bot', 'Invoice Bot'),
    tagline: L(
      'Back-office automation for supplier invoices.',
      'Automação de back office para notas de fornecedores.',
    ),
    summary: L(
      'Automation concept that reads supplier invoices, matches them to purchase orders and flags only the exceptions for a person to review.',
      'Conceito de automação que lê notas de fornecedores, cruza com os pedidos de compra e sinaliza só as exceções para revisão humana.',
    ),
    role: L('Automation engineer', 'Engenheiro de automação'),
    context: L(
      'A fictional finance team spent days each month matching invoices to orders by hand, copying values between spreadsheets.',
      'Um time financeiro fictício passava dias por mês cruzando notas e pedidos manualmente, copiando valores entre planilhas.',
    ),
    approach: L(
      'A Python job extracts invoice fields, reconciles them against order exports and writes a short exception list that the team reviews in a shared workspace.',
      'Um job em Python extrai os campos das notas, concilia com as exportações de pedidos e gera uma lista curta de exceções que o time revisa em um espaço compartilhado.',
    ),
    highlights: [
      L(
        'Matching rules written with the finance team, in their vocabulary',
        'Regras de conciliação escritas junto com o time financeiro, no vocabulário deles',
      ),
      L(
        'Every automated decision is logged with its reason',
        'Cada decisão automática fica registrada com o motivo',
      ),
      L('Exceptions dashboard refreshed every morning', 'Painel de exceções atualizado toda manhã'),
    ],
    outcome: L(
      'In the scenario, the monthly close went from four days of manual matching to a half-day review.',
      'No cenário, o fechamento mensal passou de quatro dias de conciliação manual para meio dia de revisão.',
    ),
  },
  {
    ...meta('project', 'pay-bridge'),
    slug: 'pay-bridge',
    previousSlugs: ['paybridge'],
    featured: true,
    visible: true,
    order: 30,
    year: 2024,
    kind: 'integration',
    status: 'live',
    techIds: ['Node.js', 'TypeScript', 'Stripe', 'RabbitMQ', 'PostgreSQL'].map(techId),
    skillIds: ['Node.js', 'TypeScript', 'Stripe', 'RabbitMQ', 'PostgreSQL'].map(skillRef),
    cover: fixtureImage(
      'project-pay-bridge-cover',
      L(
        'Abstract cover art for Pay Bridge: cyan and green light over a dark grid',
        'Arte de capa abstrata do Pay Bridge: luzes ciano e verde sobre uma grade escura',
      ),
    ),
    links: {
      live: 'https://example.com/pay-bridge',
      repo: 'https://example.com/pay-bridge/source',
    },
    title: L('Pay Bridge', 'Pay Bridge'),
    tagline: L(
      'A payment connector that makes retries boring.',
      'Um conector de pagamentos que torna os retries entediantes.',
    ),
    summary: L(
      'Integration concept between a storefront and a payment provider, with idempotent requests, a durable queue and readable reconciliation reports.',
      'Conceito de integração entre uma loja e um provedor de pagamentos, com requisições idempotentes, fila durável e relatórios de conciliação legíveis.',
    ),
    role: L('Backend and integration lead', 'Líder de backend e integrações'),
    context: L(
      'Payment integrations fail in quiet ways: duplicated charges, lost webhooks and reports that disagree with the bank.',
      'Integrações de pagamento falham de jeitos silenciosos: cobranças duplicadas, webhooks perdidos e relatórios que não batem com o banco.',
    ),
    approach: L(
      'Every outgoing call carries an idempotency key, every incoming webhook goes through a durable queue, and a nightly job reconciles both sides.',
      'Toda chamada de saída leva uma chave de idempotência, todo webhook recebido passa por uma fila durável e um job noturno concilia os dois lados.',
    ),
    highlights: [
      L(
        'Zero duplicated charges across the concept’s fault-injection runs',
        'Nenhuma cobrança duplicada nos testes de injeção de falhas do conceito',
      ),
      L(
        'Webhook processing survives provider outages through a durable queue',
        'O processamento de webhooks sobrevive a quedas do provedor graças a uma fila durável',
      ),
      L(
        'Reconciliation report readable by non-engineers',
        'Relatório de conciliação que qualquer pessoa do financeiro consegue ler',
      ),
      L(
        'p95 checkout latency of 420 ms in the load test',
        'Latência p95 de 420 ms no checkout durante o teste de carga',
      ),
    ],
    outcome: L(
      'The connector became the reference design for the other fictional integrations in this portfolio.',
      'O conector virou o desenho de referência para as outras integrações fictícias deste portfólio.',
    ),
  },
  {
    ...meta('project', 'lint-kit'),
    slug: 'lint-kit',
    featured: false,
    visible: true,
    order: 40,
    year: 2023,
    kind: 'open-source',
    status: 'live',
    techIds: ['TypeScript', 'Node.js', 'Git', 'GitHub'].map(techId),
    skillIds: ['TypeScript', 'Node.js', 'Git', 'GitHub'].map(skillRef),
    cover: fixtureImage(
      'project-lint-kit-cover',
      L(
        'Abstract cover art for Lint Kit: violet and amber light over a dark grid',
        'Arte de capa abstrata do Lint Kit: luzes violeta e âmbar sobre uma grade escura',
      ),
    ),
    links: { repo: 'https://example.com/lint-kit/source' },
    title: L('Lint Kit', 'Lint Kit'),
    tagline: L(
      'A shareable lint ruleset that explains every rule.',
      'Um conjunto de regras de lint compartilhável que explica cada regra.',
    ),
    summary: L(
      'Open source concept: a lint configuration where each rule links to a short rationale, so teams adopt it by agreement instead of by decree.',
      'Conceito open source: uma configuração de lint em que cada regra aponta para uma justificativa curta, para que os times adotem por acordo e não por imposição.',
    ),
    role: L('Maintainer', 'Mantenedor'),
    context: L(
      'Shared lint configs often arrive as a wall of rules nobody can explain, so teams disable them one by one.',
      'Configurações de lint compartilhadas costumam chegar como um paredão de regras que ninguém sabe explicar, e os times acabam desligando uma por uma.',
    ),
    approach: L(
      'Rules are grouped by intent, each with a one-paragraph rationale and an autofix where possible. Releases follow semantic versioning with migration notes.',
      'As regras são agrupadas por intenção, cada uma com uma justificativa de um parágrafo e autofix quando possível. As releases seguem versionamento semântico com notas de migração.',
    ),
    highlights: [
      L('Every rule documented with a rationale', 'Toda regra documentada com uma justificativa'),
      L(
        'Autofix available for most stylistic rules',
        'Autofix disponível para a maioria das regras de estilo',
      ),
      L(
        'Migration notes for every breaking release',
        'Notas de migração em toda release com breaking changes',
      ),
    ],
    outcome: L(
      'Adopted by the fictional teams in this portfolio as their shared baseline.',
      'Adotado pelos times fictícios deste portfólio como base compartilhada.',
    ),
  },
  {
    ...meta('project', 'scratch-pad'),
    slug: 'scratch-pad',
    featured: false,
    visible: false,
    order: 70,
    year: 2026,
    kind: 'web',
    status: 'in-progress',
    techIds: ['Vue.js'].map(techId),
    skillIds: ['Vue.js'].map(skillRef),
    title: L('Scratch Pad', 'Scratch Pad'),
    tagline: L(
      'A hidden experiment that must never appear in public.',
      'Um experimento oculto que nunca deve aparecer em público.',
    ),
    summary: L(
      'Hidden fixture used to prove that invisible projects stay out of every page, the sitemap and the terminal.',
      'Fixture oculta usada para provar que projetos invisíveis ficam fora de todas as páginas, do sitemap e do terminal.',
    ),
    role: L('Experiment', 'Experimento'),
    context: L(
      'Exists only to test visibility rules.',
      'Existe apenas para testar as regras de visibilidade.',
    ),
    approach: L('Marked as hidden in the dataset.', 'Marcado como oculto no dataset.'),
    highlights: [
      L('Hidden from pages', 'Oculto nas páginas'),
      L('Hidden from the sitemap', 'Oculto no sitemap'),
      L('Hidden from the terminal', 'Oculto no terminal'),
    ],
  },
];
