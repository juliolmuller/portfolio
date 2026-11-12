import { describe, expect, it } from 'vitest';

import { fixtureSnapshot, translator } from './test-utils';
import { buildVfs, resolvePath } from './vfs';

describe('resolvePath', () => {
  it.each([
    ['~', '.', '~'],
    ['~', 'projects', '~/projects'],
    ['~/projects', '..', '~'],
    ['~/projects', '../stack/x.txt', '~/stack/x.txt'],
    ['~/projects', '~', '~'],
    ['~/projects', '~/stack', '~/stack'],
    ['~/projects', '/stack', '~/stack'],
    ['~', '../..', '~'],
    ['~', './a//b/', '~/a/b'],
  ])('%s + %s → %s', (cwd, input, expected) => {
    expect(resolvePath(cwd, input)).toBe(expected);
  });
});

describe.each(['en', 'pt'] as const)('buildVfs (%s)', (locale) => {
  it('mirrors the visible content', async () => {
    const snapshot = await fixtureSnapshot(locale);
    const vfs = buildVfs(snapshot, translator(locale));
    const root = vfs.list('~').map((entry) => entry.name);

    expect(root).toEqual([
      'experience',
      'projects',
      'stack',
      'about.md',
      'contact.md',
      'education.md',
      'links.md',
      'recommended.md',
      'resume.pdf',
    ]);
    expect(vfs.list('~/projects').map((e) => e.name)).not.toContain('scratch-pad.md');
    expect(vfs.list('~/experience')).toHaveLength(snapshot.experience.length);
    expect(vfs.list('~/stack').map((e) => e.name)).toContain('frontend.txt');
    expect(vfs.stat('~/projects')).toBe('dir');
    expect(vfs.stat('~/about.md')).toBe('file');
    expect(vfs.stat('~/nope')).toBeNull();
  });

  it('localizes file contents and marks the résumé binary', async () => {
    const snapshot = await fixtureSnapshot(locale);
    const vfs = buildVfs(snapshot, translator(locale));

    expect(vfs.read('~/about.md')?.text).toContain(snapshot.profile!.bio);
    expect(vfs.read('~/resume.pdf')).toEqual({ text: '', binary: true });
    expect(vfs.read('~/projects')).toBeNull();

    const project = snapshot.projects[0]!;

    expect(vfs.read(`~/projects/${project.slug}.md`)?.text).toContain(project.context);
  });

  it('draws a tree', async () => {
    const vfs = buildVfs(await fixtureSnapshot(locale), translator(locale));
    const lines = vfs.tree('~');

    expect(lines[0]).toBe('~');
    expect(lines).toContain('├── experience/');
    expect(lines.at(-1)).toBe('└── resume.pdf');
    expect(vfs.tree('~/stack')[0]).toBe('~/stack');
  });
});

describe('buildVfs multi-paragraph summaries', () => {
  it('keeps line breaks of a role summary in the experience file', async () => {
    const snapshot = await fixtureSnapshot('en');
    const entry = snapshot.experience[0]!;
    const role = entry.roles[0]!;
    const edited = {
      ...snapshot,
      experience: [
        {
          ...entry,
          roles: [{ ...role, summary: 'Linha um\n\nLinha dois' }, ...entry.roles.slice(1)],
        },
        ...snapshot.experience.slice(1),
      ],
    };
    const vfs = buildVfs(edited, translator('en'));

    expect(vfs.read(`~/experience/${entry.slug}.md`)?.text).toContain('Linha um\n\nLinha dois');
  });
});
