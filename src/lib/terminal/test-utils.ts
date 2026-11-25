import { createTranslator } from 'next-intl';

import { type AppLocale } from '@/i18n/routing';
import { createRepository } from '@/lib/content/create-repository';
import { createFixtureSource } from '@/lib/content/fixtures/source';
import { type ContentRepository } from '@/lib/content/repository';
import { type KvItem, type LinkItem, type OutputNode, type Span } from '@/lib/terminal/output';

import enMessages from '../../../messages/en.json';
import ptMessages from '../../../messages/pt.json';
import { type Command, type CommandActions, type SessionInfo } from './commands/types';
import { type EngineDeps, execute } from './engine';
import { createRegistry, defaultRegistry } from './registry';
import { buildSnapshot, type ContentSnapshot, type SnapshotSource } from './snapshot';
import { type Translate } from './vfs';

const catalogs = { en: enMessages, pt: ptMessages };

/**
 * Throws on any missing key, so a typo in a command fails its test.
 */
export function translator(locale: AppLocale): Translate {
  const t = createTranslator({
    locale,
    messages: catalogs[locale],
    onError: (error) => {
      throw error;
    },
  });

  return t as unknown as Translate;
}

/**
 * Every public read the snapshot is built from, for one locale.
 */
export async function snapshotSourceOf(
  repository: ContentRepository,
  locale: AppLocale,
): Promise<SnapshotSource> {
  const [profile, contact, resume, links, recommended, projects, experience, education, skills] =
    await Promise.all([
      repository.getProfile(locale),
      repository.getContact(locale),
      repository.getResume(),
      repository.getFeaturedLinks(locale),
      repository.getRecommendedProfiles(locale),
      repository.getProjects(locale),
      repository.getExperience(locale),
      repository.getEducation(locale),
      repository.getSkills(locale),
    ]);

  return {
    locale,
    profile,
    contact,
    resume,
    links,
    recommended,
    projects,
    experience,
    education,
    skills,
  };
}

export async function fixtureSnapshot(locale: AppLocale): Promise<ContentSnapshot> {
  const repository = createRepository(createFixtureSource(), {
    warn: () => {},
  });

  return buildSnapshot(await snapshotSourceOf(repository, locale));
}

export interface Harness {
  calls: string[];
  deps: EngineDeps;
  run(line: string, signal?: AbortSignal): Promise<OutputNode[]>;
}

export async function createHarness(
  locale: AppLocale,
  options: {
    cwd?: string;
    extraCommands?: Command[];
    history?: string[];
    loadContent?: () => Promise<ContentSnapshot>;
    loadSecret?: EngineDeps['loadSecret'];
    readSecret?: EngineDeps['readSecret'];
    reducedMotion?: boolean;
    session?: null | SessionInfo;
  } = {},
): Promise<Harness> {
  const snapshot = await fixtureSnapshot(locale);
  const calls: string[] = [];
  const actions: CommandActions = {
    navigate: (href) => calls.push(`navigate:${href}`),
    scrollToSection: (id) => calls.push(`scroll:${id}`),
    setLocale: (next) => calls.push(`locale:${next}`),
    setCwd: (path) => calls.push(`cwd:${path}`),
    clear: () => calls.push('clear'),
    downloadResume: (next) => calls.push(`download:${next}`),
    openExternal: (url) => calls.push(`external:${url}`),
    goTo: (url) => calls.push(`goto:${url}`),
    setSession: (session) => calls.push(session ? 'session:on' : 'session:off'),
    effect: (effect) => calls.push(`effect:${effect ?? 'off'}`),
    window: {
      close: () => calls.push('close'),
      minimize: () => calls.push('minimize'),
      maximize: () => calls.push('maximize'),
    },
  };
  const registry = options.extraCommands
    ? createRegistry([...defaultRegistry.publicCommands(), ...options.extraCommands])
    : defaultRegistry;
  const deps: EngineDeps = {
    registry,
    locale,
    t: translator(locale),
    cwd: options.cwd ?? '~',
    history: options.history ?? [],
    actions,
    loadContent: options.loadContent ?? (async (): Promise<ContentSnapshot> => snapshot),
    delay: async (_ms, signal) => {
      if (signal.aborted) throw new Error('aborted');
    },
    shortcutLabel: 'Ctrl /',
    reducedMotion: options.reducedMotion ?? false,
    session: options.session ?? null,
    ...(options.readSecret ? { readSecret: options.readSecret } : {}),
    ...(options.loadSecret ? { loadSecret: options.loadSecret } : {}),
  };

  return {
    deps,
    calls,
    async run(
      line,
      signal = new AbortController().signal,
    ): Promise<
      Array<
        | { fallback?: string; label?: string; lines: string[]; type: 'ascii' }
        | { head?: string[]; rows: string[][]; type: 'table' }
        | { items: Array<{ command: string; label?: string }>; type: 'command' }
        | { items: KvItem[]; type: 'kv' }
        | { items: LinkItem[]; type: 'link' }
        | { lines: string[]; type: 'tree' }
        | { spans: Span[]; type: 'text'; typed?: boolean }
        | { type: 'blank' }
      >
    > {
      const nodes: OutputNode[] = [];
      for await (const node of execute(line, deps, signal)) nodes.push(node);

      return nodes.filter((node) => node.type !== 'spinner');
    },
  };
}

/**
 * Plain text of some output, for assertions.
 */
export function flatten(nodes: readonly OutputNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'ascii':
          return node.lines.join('\n');
        case 'blank':
          return '';
        case 'command':
          return node.items.map((item) => item.label ?? item.command).join(' ');
        case 'kv':
          return node.items.map((item) => `${item.key}: ${item.value}`).join('\n');
        case 'link':
          return node.items.map((item) => `${item.label} ${item.href}`).join('\n');
        case 'spinner':
          return node.label;
        case 'table':
          return [...(node.head ? [node.head] : []), ...node.rows]
            .map((row) => row.join(' | '))
            .join('\n');
        case 'text':
          return node.spans.map((span) => span.text).join('');
        case 'tree':
          return node.lines.join('\n');
      }
    })
    .join('\n');
}
