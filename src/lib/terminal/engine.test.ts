import { describe, expect, it } from 'vitest';

import { type AppLocale } from '@/i18n/routing';
import { createRepository } from '@/lib/content/create-repository';
import { createFixtureDataset } from '@/lib/content/fixtures/dataset';
import { techId } from '@/lib/content/fixtures/ids';
import { createFixtureSource } from '@/lib/content/fixtures/source';
import { skillIdFor } from '@/lib/content/migrations/skills';

import { type Command } from './commands/types';
import { defaultRegistry, publicCommands } from './registry';
import { buildSnapshot } from './snapshot';
import { createHarness, flatten, snapshotSourceOf, translator } from './test-utils';

const LOCALES: AppLocale[] = ['en', 'pt'];

const secret: Command = {
  name: 'zyzzyva',
  summaryKey: 'terminal.commands.help.summary',
  usageKey: 'terminal.commands.help.usage',
  group: 'fun',
  visibility: 'secret',
  async run() {
    return [{ type: 'text', spans: [{ text: 'SECRET-OUTPUT' }] }];
  },
};

describe.each(LOCALES)('commands (%s)', (locale) => {
  it('prints usage for --help and -h on every public command', async () => {
    const harness = await createHarness(locale);
    for (const command of publicCommands) {
      for (const flag of ['--help', '-h']) {
        const output = flatten(await harness.run(`${command.name} ${flag}`));

        expect(output, command.name).toContain(harness.deps.t(command.usageKey));
      }
    }
  });

  it('help lists every public command with a clickable chip', async () => {
    const harness = await createHarness(locale);
    const nodes = await harness.run('help');
    const chips = nodes.flatMap((node) =>
      node.type === 'kv' ? node.items.flatMap((item) => item.command ?? []) : [],
    );

    expect(chips.sort()).toEqual(publicCommands.map((c) => c.name).sort());
    expect(flatten(nodes)).toContain('Ctrl /');
    expect(flatten(await harness.run('man about'))).toContain('about');
  });

  it('about, experience, education and whoami', async () => {
    const harness = await createHarness(locale);

    expect(flatten(await harness.run('about'))).toContain('Julio');

    const experience = flatten(await harness.run('experience'));
    for (const company of ['Lumen Works', 'Northbridge Labs', 'Fable']) {
      expect(experience).toContain(company);
    }
    expect(flatten(await harness.run('education'))).toContain('Example');
    expect(flatten(await harness.run('whoami'))).toBe('visitor');
  });

  it('contact shows the address but never a phone number', async () => {
    const harness = await createHarness(locale);
    const output = flatten(await harness.run('contact'));

    expect(output).toContain('hello@example.com');
    expect(output).not.toMatch(/\+\d|tel:/);
    expect(flatten(await harness.run('socials'))).toBe(output);
  });

  it('links and recommend skip hidden items', async () => {
    const harness = await createHarness(locale);
    const links = await harness.run('links');

    expect(flatten(links)).toContain('GitHub');
    expect(links[0]).toMatchObject({ type: 'link' });

    const recommended = flatten(await harness.run('recommend'));

    expect(recommended).toContain('Ada Sample');
    expect(recommended).not.toContain('Sofia Demo');
    expect(flatten(await harness.run('following'))).toBe(recommended);
  });

  it('skills groups skills by category and never shows levels', async () => {
    const harness = await createHarness(locale);
    const all = flatten(await harness.run('skills'));

    expect(all).toContain('TypeScript');
    expect(all).toContain('PostgreSQL');
    expect(all).toContain(translator(locale)('stack.categories.engineering'));
    expect(all).toContain('SOLID');
    expect(all).not.toContain('Practices and concepts');
    expect(all).not.toContain('Práticas e conceitos');
    expect(all).not.toMatch(/%|★/);

    const frontend = flatten(await harness.run('skills --category frontend'));

    expect(frontend).toContain('React');
    expect(frontend).not.toContain('PostgreSQL');
    expect(flatten(await harness.run('stack --category=frontend'))).toBe(frontend);

    const engineering = flatten(await harness.run('skills --category engineering'));

    expect(engineering).toContain('SOLID');
    expect(engineering).not.toContain('React');

    const labelPrefix = translator(locale)('stack.categories.engineering').slice(0, 4);

    expect(flatten(await harness.run(`skills --category ${labelPrefix}`))).toBe(engineering);
    expect(flatten(await harness.run('skills --category nope'))).toContain('nope');
    expect(flatten(await harness.run('skills --category nope'))).toContain('engineering');
  });

  it('skills leaves out a hidden skill', async () => {
    const react = skillIdFor(techId('React'));
    const dataset = createFixtureDataset();

    for (const skill of dataset.skill) {
      if (skill.id === react) skill.visible = false;
    }

    const repository = createRepository(createFixtureSource(dataset), { warn: () => {} });
    const snapshot = buildSnapshot(await snapshotSourceOf(repository, locale));
    const harness = await createHarness(locale, { loadContent: async () => snapshot });

    // "React Native" stays; only the exact name must be gone.
    expect(flatten(await harness.run('skills'))).not.toMatch(/(^|· )React( ·|$)/m);
  });

  it('projects lists visible projects only and filters', async () => {
    const harness = await createHarness(locale);
    const all = flatten(await harness.run('projects'));

    expect(all).toContain('orbit-dashboard');
    expect(all).not.toContain('scratch-pad');

    const web = flatten(await harness.run('projects --kind web'));

    expect(web).toContain('orbit-dashboard');
    expect(web).not.toContain('pocket-ledger');

    const featured = flatten(await harness.run('projects --featured'));

    expect(featured).toContain('pay-bridge');
    expect(featured).not.toContain('tidy-desk');
    expect(flatten(await harness.run('projects --kind nope'))).toContain('nope');
  });

  it('open and projects open navigate, goto scrolls', async () => {
    const harness = await createHarness(locale);

    await harness.run('open pay-bridge');
    await harness.run('projects open orbit-dashboard');
    await harness.run('open projects/tidy-desk.md');
    await harness.run('goto stack');
    await harness.run('open contact');
    expect(harness.calls).toEqual([
      'navigate:/projects/pay-bridge',
      'navigate:/projects/orbit-dashboard',
      'navigate:/projects/tidy-desk',
      'scroll:stack',
      'scroll:contact',
    ]);
    expect(flatten(await harness.run('open scratch-pad'))).toContain('scratch-pad');
    expect(flatten(await harness.run('open paybridge'))).toContain('paybridge');
    expect(flatten(await harness.run('goto nowhere'))).toContain('nowhere');
  });

  it('open resume.pdf and resume --download use the current locale', async () => {
    const harness = await createHarness(locale);

    await harness.run('open resume.pdf');
    await harness.run('resume --download');
    expect(harness.calls).toEqual([`download:${locale}`, `download:${locale}`]);
    expect(flatten(await harness.run('resume'))).toContain('resume --download');
  });

  it('opens a featured link in a new tab', async () => {
    const harness = await createHarness(locale);

    await harness.run('open github');
    expect(harness.calls[0]).toMatch(/^external:https:\/\//);
  });

  it('neofetch only shows snapshot data', async () => {
    const harness = await createHarness(locale);
    const nodes = await harness.run('neofetch');

    expect(nodes.map((node) => node.type)).toEqual(['ascii', 'kv']);
    expect(flatten(nodes)).toContain('Curitiba');
  });

  it('git log --oneline renders the career newest first', async () => {
    const harness = await createHarness(locale);
    const nodes = await harness.run('git log --oneline');
    const lines = nodes.map((node) => flatten([node]));

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) /);
    expect(lines[1]).toMatch(/^[0-9a-f]{7} /);
    expect(flatten(await harness.run('git status'))).toContain('git log --oneline');
  });

  it('lang confirms before asking the site to switch', async () => {
    const harness = await createHarness(locale);
    const other = locale === 'en' ? 'pt' : 'en';
    const nodes = await harness.run(`lang ${other}`);

    expect(nodes).toHaveLength(1);
    expect(harness.calls).toEqual([`locale:${other}`]);
    expect(flatten(await harness.run(`lang ${locale}`))).not.toBe('');
    expect(flatten(await harness.run('lang xx'))).toContain('xx');
    expect(flatten(await harness.run('lang'))).toContain('en');
  });

  it('system commands act through the actions', async () => {
    const harness = await createHarness(locale, { history: ['ls', 'help'] });

    await harness.run('clear');
    await harness.run('exit');
    await harness.run('minimize');
    await harness.run('maximize');
    expect(harness.calls).toEqual(['clear', 'close', 'minimize', 'maximize']);
    expect(flatten(await harness.run('echo "a  b" c'))).toBe('a  b c');
    expect(flatten(await harness.run('history'))).toContain('2  help');
    expect(flatten(await harness.run('uname -a'))).toContain('julio-muller');
    expect(flatten(await harness.run('date'))).not.toBe('');
  });

  it('file system commands read the snapshot', async () => {
    const harness = await createHarness(locale);

    expect(flatten(await harness.run('ls'))).toContain('experience/');
    expect(flatten(await harness.run('ls projects'))).toContain('orbit-dashboard.md');
    expect(flatten(await harness.run('ls projects'))).not.toContain('scratch-pad');
    await harness.run('cd projects');
    await harness.run('cd ..');
    await harness.run('cd /stack');
    expect(harness.calls).toEqual(['cwd:~/projects', 'cwd:~', 'cwd:~/stack']);
    expect(flatten(await harness.run('cd about.md'))).toContain('about.md');
    expect(flatten(await harness.run('cd nope'))).toContain('nope');
    expect(flatten(await harness.run('pwd'))).toBe('~');
    expect(flatten(await harness.run('cat about.md'))).toContain('Julio');
    expect(flatten(await harness.run('cat projects/pay-bridge.md'))).toContain('Pay');
    expect(flatten(await harness.run('cat resume.pdf'))).toContain('open resume.pdf');
    expect(flatten(await harness.run('cat projects'))).toContain('projects');
    expect(flatten(await harness.run('cat ghost.md'))).toContain('ghost.md');
    expect(flatten(await harness.run('tree'))).toContain('└──');

    const relative = await createHarness(locale, { cwd: '~/projects' });

    expect(flatten(await relative.run('ls'))).toContain('pay-bridge.md');
    expect(flatten(await relative.run('cat ../about.md'))).toContain('Julio');
  });
});

describe('engine behavior', () => {
  it('reports unsupported shell syntax in both languages', async () => {
    for (const locale of LOCALES) {
      const harness = await createHarness(locale);
      for (const line of ['ls; pwd', 'ls | cat', 'ls > x', 'ls *', 'echo $HOME', 'echo "x']) {
        const nodes = await harness.run(line);

        expect(nodes, line).toHaveLength(1);
        expect(nodes[0]).toMatchObject({ type: 'text' });
      }
    }
  });

  it('suggests close public commands for unknown input', async () => {
    const harness = await createHarness('en');
    const typo = flatten(await harness.run('hepl'));

    expect(typo).toContain('command not found: hepl');
    expect(typo).toContain('Did you mean help?');
    expect(flatten(await harness.run('xyzzy'))).not.toContain('Did you mean');
    expect(flatten(await harness.run('xyzzy'))).toContain('help');
  });

  it('ignores blank lines', async () => {
    const harness = await createHarness('en');

    expect(await harness.run('   ')).toEqual([]);
  });

  it('shows a spinner while content loads and degrades on failure', async () => {
    let fail = true;
    const harness = await createHarness('en', {
      loadContent: async () => {
        if (fail) throw new Error('offline');

        return (await createHarness('en')).deps.loadContent();
      },
    });
    const first: string[] = [];
    const { execute } = await import('./engine');
    for await (const node of execute('projects', harness.deps, new AbortController().signal)) {
      first.push(node.type);
    }
    expect(first).toEqual(['spinner', 'text']);
    expect(flatten(await harness.run('projects'))).toContain('Could not load');
    // Commands that need no content keep working.
    expect(flatten(await harness.run('echo still works'))).toBe('still works');
    fail = false;
    expect(flatten(await harness.run('projects'))).toContain('orbit-dashboard');
  });

  it('stops streaming when aborted', async () => {
    const harness = await createHarness('en');
    const controller = new AbortController();
    const { execute } = await import('./engine');
    const seen: string[] = [];
    for await (const node of execute('git log --oneline', harness.deps, controller.signal)) {
      if (node.type === 'text') {
        seen.push('line');
        controller.abort();
      }
    }
    expect(seen).toEqual(['line']);
  });
});

describe('secret commands', () => {
  it('never appear in help, suggestions or recordable history', async () => {
    const harness = await createHarness('en', { extraCommands: [secret] });

    expect(flatten(await harness.run('help'))).not.toContain('zyzzyva');
    expect(flatten(await harness.run('zyzzyv'))).not.toContain('Did you mean zyzzyva');
    expect(harness.deps.registry.suggest('zyzzyva')).toBeNull();
    expect(harness.deps.registry.isSecret('zyzzyva')).toBe(true);
    expect(defaultRegistry.isSecret('zyzzyva')).toBe(false);
  });

  it('are indistinguishable from unknown commands while unavailable', async () => {
    const unavailable = await createHarness('en');
    const typed = await unavailable.run('zyzzyva');
    const unknown = await unavailable.run('zyzzyx');

    expect(flatten(typed)).toBe(flatten(unknown).replace('zyzzyx', 'zyzzyva'));
  });
});
