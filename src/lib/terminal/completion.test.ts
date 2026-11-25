import { describe, expect, it } from 'vitest';

import {
  applyCompletion,
  commonPrefix,
  complete,
  type Completion,
} from '@/lib/terminal/completion';

import { type Command } from './commands/types';
import { buildContext } from './engine';
import { createRegistry, defaultRegistry, publicCommands } from './registry';
import { createHarness } from './test-utils';

const secret: Command = {
  name: 'sesame',
  summaryKey: 'terminal.commands.help.summary',
  usageKey: 'terminal.commands.help.usage',
  group: 'fun',
  visibility: 'secret',
  complete: () => ['hidden-arg'],
  async run() {
    return [];
  },
};

async function candidates(
  line: string,
  cwd = '~',
  registry = defaultRegistry,
): Promise<Completion> {
  const harness = await createHarness('en', { cwd });
  const content = await harness.deps.loadContent();
  const ctx = buildContext({ ...harness.deps, registry }, content, new AbortController().signal);

  return complete(line, line.length, registry, ctx);
}

describe('complete', () => {
  it('completes command names and aliases', async () => {
    expect((await candidates('he')).candidates).toEqual(['help']);
    expect((await candidates('pro')).candidates).toEqual(['projects']);
    expect((await candidates('s')).candidates).toEqual(
      expect.arrayContaining(['skills', 'socials', 'stack']),
    );
    expect((await candidates('')).candidates.length).toBeGreaterThanOrEqual(publicCommands.length);
  });

  it('completes paths, directories first with a trailing slash', async () => {
    expect((await candidates('cd pro')).candidates).toEqual(['projects/']);
    expect((await candidates('cd a')).candidates).toEqual([]);
    expect((await candidates('cat projects/or')).candidates).toEqual([
      'projects/orbit-dashboard.md',
    ]);
    expect((await candidates('cat ', '~/stack')).candidates).toEqual(
      expect.arrayContaining(['frontend.txt', 'engineering.txt']),
    );
  });

  it('completes project slugs, sections, languages and flags', async () => {
    expect((await candidates('open pay')).candidates).toEqual(['pay-bridge']);
    expect((await candidates('open res')).candidates).toEqual(
      expect.arrayContaining(['resume.pdf']),
    );
    expect((await candidates('goto st')).candidates).toEqual(['stack']);
    expect((await candidates('lang p')).candidates).toEqual(['pt']);
    expect((await candidates('projects --kind w')).candidates).toEqual(['web']);
    expect((await candidates('projects open ti')).candidates).toEqual(['tidy-desk']);
    expect((await candidates('skills --category fr')).candidates).toEqual(['frontend']);
    expect((await candidates('skills --category en')).candidates).toEqual(['engineering']);
    expect((await candidates('help ab')).candidates).toEqual(['about']);
  });

  it('offers nothing for unknown commands', async () => {
    expect((await candidates('nope x')).candidates).toEqual([]);
  });

  it('never completes secret commands or their arguments', async () => {
    const registry = createRegistry([...publicCommands, secret]);

    expect((await candidates('ses', '~', registry)).candidates).toEqual([]);
    expect((await candidates('sesame hi', '~', registry)).candidates).toEqual([]);
  });
});

describe('applyCompletion', () => {
  it('inserts a single candidate, with a space unless it is a directory', () => {
    expect(applyCompletion('he', 2, { start: 0, candidates: ['help'] })).toMatchObject({
      line: 'help ',
      cursor: 5,
      progressed: true,
    });
    expect(applyCompletion('cd pro', 6, { start: 3, candidates: ['projects/'] })).toMatchObject({
      line: 'cd projects/',
      cursor: 12,
    });
  });

  it('inserts the common prefix, then reports no progress', () => {
    const completion = { start: 0, candidates: ['skills', 'socials', 'stack'] };

    expect(applyCompletion('s', 1, completion)).toMatchObject({
      progressed: false,
      line: 's',
    });

    const narrowed = { start: 0, candidates: ['socials', 'society'] };

    expect(applyCompletion('s', 1, narrowed)).toMatchObject({
      line: 'soci',
      progressed: true,
    });
  });

  it('keeps text after the cursor and ignores empty candidates', () => {
    expect(applyCompletion('he x', 2, { start: 0, candidates: ['help'] }).line).toBe('help  x');
    expect(applyCompletion('zz', 2, { start: 0, candidates: [] }).progressed).toBe(false);
  });

  it('computes common prefixes', () => {
    expect(commonPrefix(['abc', 'abd'])).toBe('ab');
    expect(commonPrefix(['abc'])).toBe('abc');
    expect(commonPrefix([])).toBe('');
  });
});
