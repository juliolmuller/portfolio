import { formatPartialDate } from '@/lib/format';

import { type OutputNode, text } from '../../output';
import { errorText, lines, periodLabel } from '../helpers';
import { type Command, type CommandContext } from '../types';

const CATEGORIES = [
  'language',
  'frontend',
  'backend',
  'data',
  'cloud',
  'integration',
  'ai',
] as const;

const KINDS = ['web', 'mobile', 'desktop', 'automation', 'integration', 'open-source'] as const;

const about: Command = {
  name: 'about',
  summaryKey: 'terminal.commands.about.summary',
  usageKey: 'terminal.commands.about.usage',
  group: 'explore',
  visibility: 'public',
  needsContent: true,
  async run(ctx) {
    const { profile } = ctx.content;

    if (!profile) return [text(ctx.t('terminal.empty'), 'warn')];

    return [
      lines({ text: profile.displayName, tone: 'bold' }, { text: profile.jobTitle, tone: 'dim' }),
      { type: 'blank' },
      text(profile.bio),
      { type: 'blank' },
      text(ctx.t('terminal.about.pointer'), 'dim'),
      { type: 'command', items: [{ command: 'experience' }] },
    ];
  },
};

const experience: Command = {
  name: 'experience',
  summaryKey: 'terminal.commands.experience.summary',
  usageKey: 'terminal.commands.experience.usage',
  group: 'explore',
  visibility: 'public',
  needsContent: true,
  async run(ctx) {
    const entries = ctx.content.experience;

    if (entries.length === 0) return [text(ctx.t('terminal.empty'), 'warn')];

    const date = (value: string): string => formatPartialDate(ctx.locale, value);

    return entries.flatMap((entry): OutputNode[] => [
      lines(
        { text: entry.company, tone: 'bold' },
        ...(entry.location ? [{ text: entry.location, tone: 'dim' as const }] : []),
        ...entry.roles.flatMap((role) => [
          {
            text: `${role.title} (${periodLabel(ctx, date, role.start, role.end)})`,
            tone: 'accent' as const,
          },
          { text: role.summary },
          ...role.bullets.map((bullet) => ({ text: `- ${bullet}` })),
        ]),
      ),
      { type: 'blank' },
    ]);
  },
};

const education: Command = {
  name: 'education',
  summaryKey: 'terminal.commands.education.summary',
  usageKey: 'terminal.commands.education.usage',
  group: 'explore',
  visibility: 'public',
  needsContent: true,
  async run(ctx) {
    const entries = ctx.content.education;

    if (entries.length === 0) return [text(ctx.t('terminal.empty'), 'warn')];

    const date = (value: string): string => formatPartialDate(ctx.locale, value);

    return [
      lines(
        ...entries.flatMap((entry) => [
          { text: entry.title, tone: 'bold' as const },
          {
            text: `${ctx.t(`resume.kinds.${entry.kind}`)} · ${entry.institution}${
              entry.start || entry.end ? ` · ${periodLabel(ctx, date, entry.start, entry.end)}` : ''
            }`,
            tone: 'dim' as const,
          },
        ]),
      ),
    ];
  },
};

const contact: Command = {
  name: 'contact',
  aliases: ['socials'],
  summaryKey: 'terminal.commands.contact.summary',
  usageKey: 'terminal.commands.contact.usage',
  group: 'explore',
  visibility: 'public',
  needsContent: true,
  async run(ctx) {
    const { contact: parts, links } = ctx.content;
    const output: OutputNode[] = [];

    if (parts) {
      output.push({
        type: 'kv',
        items: [
          {
            key: ctx.t('terminal.labels.email'),
            value: `${parts.user}@${parts.domain}`,
          },
        ],
      });
      output.push({
        type: 'link',
        items: [
          {
            label: `${parts.user}@${parts.domain}`,
            href: `mailto:${parts.user}@${parts.domain}`,
          },
          ...(parts.bookingUrl
            ? [
                {
                  label: ctx.t('terminal.labels.booking'),
                  href: parts.bookingUrl,
                  external: true,
                },
              ]
            : []),
        ],
      });
    }

    if (links.length > 0) {
      output.push(text(ctx.t('terminal.labels.links'), 'dim'), {
        type: 'link',
        items: links.map((link) => ({
          label: link.label,
          href: link.url,
          external: /^https?:/.test(link.url),
        })),
      });
    }

    return output.length > 0 ? output : [text(ctx.t('terminal.empty'), 'warn')];
  },
};

const links: Command = {
  name: 'links',
  summaryKey: 'terminal.commands.links.summary',
  usageKey: 'terminal.commands.links.usage',
  group: 'explore',
  visibility: 'public',
  needsContent: true,
  async run(ctx) {
    if (ctx.content.links.length === 0) {
      return [text(ctx.t('terminal.empty'), 'warn')];
    }

    return [
      {
        type: 'link',
        items: ctx.content.links.map((link) => ({
          label: link.label,
          href: link.url,
          external: /^https?:/.test(link.url),
        })),
      },
    ];
  },
};

const recommend: Command = {
  name: 'recommend',
  aliases: ['following'],
  summaryKey: 'terminal.commands.recommend.summary',
  usageKey: 'terminal.commands.recommend.usage',
  group: 'explore',
  visibility: 'public',
  needsContent: true,
  async run(ctx) {
    if (ctx.content.recommended.length === 0) {
      return [text(ctx.t('terminal.empty'), 'warn')];
    }

    return ctx.content.recommended.flatMap((person): OutputNode[] => [
      lines(
        { text: person.name, tone: 'bold' },
        { text: person.role, tone: 'dim' },
        { text: person.note },
      ),
      {
        type: 'link',
        items: [{ label: person.url, href: person.url, external: true }],
      },
    ]);
  },
};

function matchCategory(
  ctx: CommandContext,
  value: string,
): 'ai' | 'backend' | 'cloud' | 'data' | 'frontend' | 'integration' | 'language' | undefined {
  const needle = value.toLowerCase();

  return CATEGORIES.find(
    (id) =>
      id === needle
      || `${id}s` === needle
      || ctx.t(`stack.categories.${id}`).toLowerCase().startsWith(needle),
  );
}

const skills: Command = {
  name: 'skills',
  aliases: ['stack'],
  summaryKey: 'terminal.commands.skills.summary',
  usageKey: 'terminal.commands.skills.usage',
  group: 'explore',
  visibility: 'public',
  valueFlags: ['category'],
  needsContent: true,
  complete: (_ctx, args, partial) =>
    args.at(-1) === '--category'
      ? CATEGORIES.filter((id) => id.startsWith(partial))
      : '--category'.startsWith(partial)
        ? ['--category']
        : [],
  async run(ctx, args) {
    const requested = args.flags['category'];
    let selected: ReadonlyArray<(typeof CATEGORIES)[number]> = CATEGORIES;

    if (typeof requested === 'string') {
      const match = matchCategory(ctx, requested);

      if (!match) {
        return [
          errorText(ctx.t('terminal.skills.unknown', { category: requested })),
          text(ctx.t('terminal.skills.available', { list: CATEGORIES.join(', ') }), 'dim'),
        ];
      }

      selected = [match];
    }

    const output: OutputNode[] = [];
    for (const id of selected) {
      const names = ctx.content.technologies
        .filter((tech) => tech.category === id)
        .map((tech) => tech.name);

      if (names.length === 0) continue;

      output.push(
        text(ctx.t(`stack.categories.${id}`), 'bold'),
        text(names.join(' · '), 'accent'),
        { type: 'blank' },
      );
    }

    if (typeof requested !== 'string' && ctx.content.practices.length > 0) {
      output.push(
        text(ctx.t('stack.practicesTitle'), 'bold'),
        text(ctx.content.practices.join(' · '), 'accent'),
      );
    }

    return output.length > 0 ? output : [text(ctx.t('terminal.empty'), 'warn')];
  },
};

const projects: Command = {
  name: 'projects',
  summaryKey: 'terminal.commands.projects.summary',
  usageKey: 'terminal.commands.projects.usage',
  group: 'explore',
  visibility: 'public',
  valueFlags: ['kind'],
  needsContent: true,
  complete: (ctx, args, partial) => {
    if (args.at(-1) === '--kind') return KINDS.filter((k) => k.startsWith(partial));

    if (args[0] === 'open') {
      return ctx.content.projects
        .map((project) => project.slug)
        .filter((slug) => slug.startsWith(partial));
    }

    return ['open', '--kind', '--featured'].filter((c) => c.startsWith(partial));
  },
  async run(ctx, args) {
    if (args.positionals[0] === 'open') {
      const slug = args.positionals[1];
      const project = ctx.content.projects.find((item) => item.slug === slug);

      if (!project) {
        return [errorText(ctx.t('terminal.open.unknown', { target: slug ?? '' }))];
      }

      ctx.actions.navigate(`/projects/${project.slug}`);

      return [text(ctx.t('terminal.open.project', { title: project.title }), 'success')];
    }

    const kind = args.flags['kind'];

    if (typeof kind === 'string' && !(KINDS as readonly string[]).includes(kind)) {
      return [
        errorText(ctx.t('terminal.projects.unknownKind', { kind })),
        text(ctx.t('terminal.projects.kinds', { list: KINDS.join(', ') }), 'dim'),
      ];
    }

    const rows = ctx.content.projects
      .filter((project) => (typeof kind === 'string' ? project.kind === kind : true))
      .filter((project) => (args.flags['featured'] ? project.featured : true));

    if (rows.length === 0) return [text(ctx.t('terminal.projects.none'), 'warn')];

    return [
      {
        type: 'table',
        head: [
          ctx.t('terminal.projects.head.slug'),
          ctx.t('project.kind'),
          ctx.t('project.year'),
          ctx.t('terminal.projects.head.summary'),
        ],
        rows: rows.map((project) => [
          project.slug,
          ctx.t(`work.kinds.${project.kind}`),
          String(project.year),
          project.tagline,
        ]),
      },
      text(ctx.t('terminal.projects.hint'), 'dim'),
    ];
  },
};

const resume: Command = {
  name: 'resume',
  summaryKey: 'terminal.commands.resume.summary',
  usageKey: 'terminal.commands.resume.usage',
  group: 'explore',
  visibility: 'public',
  needsContent: true,
  complete: (_ctx, _args, partial) => ('--download'.startsWith(partial) ? ['--download'] : []),
  async run(ctx, args) {
    const available = ctx.content.resume[ctx.locale];

    if (args.flags['download']) {
      if (!available) return [text(ctx.t('terminal.resume.unavailable'), 'warn')];

      ctx.actions.downloadResume(ctx.locale);

      return [text(ctx.t('terminal.open.resume'), 'success')];
    }

    const latest = ctx.content.experience[0]?.roles[0];
    const company = ctx.content.experience[0]?.company;

    return [
      lines(
        {
          text: ctx.content.profile
            ? `${ctx.content.profile.displayName} · ${ctx.content.profile.jobTitle}`
            : '',
          tone: 'bold',
        },
        ...(latest && company
          ? [
              {
                text: ctx.t('terminal.resume.latest', {
                  title: latest.title,
                  company,
                }),
              },
            ]
          : []),
        {
          text: ctx.t('terminal.resume.counts', {
            companies: ctx.content.experience.length,
            education: ctx.content.education.length,
          }),
        },
      ),
      available
        ? text(ctx.t('terminal.resume.download'), 'dim')
        : text(ctx.t('terminal.resume.unavailable'), 'warn'),
      ...(available
        ? [
            {
              type: 'command' as const,
              items: [{ command: 'resume --download' }],
            },
          ]
        : []),
    ];
  },
};

export const MARK = [
  '    ██╗███╗   ███╗',
  '    ██║████╗ ████║',
  '    ██║██╔████╔██║',
  '██  ██║██║╚██╔╝██║',
  '╚█████╔╝██║ ╚═╝ ██║',
  ' ╚════╝ ╚═╝     ╚═╝',
];

const neofetch: Command = {
  name: 'neofetch',
  summaryKey: 'terminal.commands.neofetch.summary',
  usageKey: 'terminal.commands.neofetch.usage',
  group: 'fun',
  visibility: 'public',
  needsContent: true,
  async run(ctx) {
    const { profile } = ctx.content;

    if (!profile) return [text(ctx.t('terminal.empty'), 'warn')];

    return [
      { type: 'ascii', lines: MARK, fallback: 'JM' },
      {
        type: 'kv',
        items: [
          { key: ctx.t('terminal.labels.name'), value: profile.displayName },
          { key: ctx.t('terminal.labels.role'), value: profile.jobTitle },
          { key: ctx.t('terminal.labels.location'), value: profile.location },
          {
            key: ctx.t('terminal.labels.languages'),
            value: profile.spokenLanguages.join(', '),
          },
          { key: ctx.t('terminal.labels.focus'), value: profile.focus },
          ...profile.metrics.map((metric) => ({
            key: metric.label,
            value: metric.value,
          })),
        ],
      },
    ];
  },
};

/**
 * FNV-1a, folded to 7 hex digits: a stable, commit-looking id.
 */
export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (const char of input) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0').slice(0, 7);
}

const git: Command = {
  name: 'git',
  summaryKey: 'terminal.commands.git.summary',
  usageKey: 'terminal.commands.git.usage',
  group: 'fun',
  visibility: 'public',
  needsContent: true,
  complete: (_ctx, args, partial) =>
    args.length === 0
      ? ['log'].filter((c) => c.startsWith(partial))
      : ['--oneline'].filter((c) => c.startsWith(partial)),
  async *run(ctx, args) {
    if (args.positionals[0] !== 'log' || !args.flags['oneline']) {
      yield errorText(ctx.t('terminal.git.onlyLog'));

      return;
    }

    const commits = ctx.content.experience
      .flatMap((entry) =>
        entry.roles.map((role) => ({
          start: role.start,
          hash: shortHash(`${entry.slug}:${role.title}:${role.start}`),
          message: ctx.t('terminal.git.milestone', {
            title: role.title,
            company: entry.company,
          }),
        })),
      )
      .sort((a, b) => b.start.localeCompare(a.start));

    if (commits.length === 0) {
      yield text(ctx.t('terminal.empty'), 'warn');

      return;
    }

    for (const [index, commit] of commits.entries()) {
      yield {
        type: 'text',
        spans: [
          { text: `${commit.hash} `, tone: 'warn' },
          ...(index === 0 ? [{ text: '(HEAD -> main) ', tone: 'accent' as const }] : []),
          { text: commit.message },
        ],
      };
      await ctx.delay(80);
    }
  },
};

export const exploreCommands: Command[] = [
  about,
  experience,
  education,
  contact,
  links,
  recommend,
  skills,
  projects,
  resume,
  neofetch,
  git,
];
