import { describe, expect, it } from 'vitest';

import { buildLlmsTxt, type LlmsSection, renderLlmsTxt } from './llms';

const link = (path: string): LlmsSection['links'][number] => ({
  label: 'L',
  path,
  description: 'D',
});
const built = buildLlmsTxt({
  name: 'Ada',
  summary: 'Summary en',
  intro: 'Intro',
  sections: [
    { locale: 'en', heading: 'Pages', summary: 'Summary en', links: [link('/en')] },
    { locale: 'pt', heading: 'Páginas', summary: 'Resumo pt', links: [link('/pt/projects')] },
  ],
  absolute: (path) => `https://x.test${path}`,
});

describe('buildLlmsTxt', () => {
  it('has a single H1 as the first line, followed by a summary quote', () => {
    const lines = built.split('\n');

    expect(lines[0]).toBe('# Ada');
    expect(built.match(/^# /gm)).toHaveLength(1);
    expect(lines[2]).toBe('> Summary en');
  });

  it('has one section per locale, default first, with absolute links', () => {
    expect(built.match(/^## .*/gm)).toEqual(['## Pages', '## Páginas']);
    expect(built).toContain('- [L](https://x.test/en): D');
    expect(built).toContain('- [L](https://x.test/pt/projects): D');
  });

  it('uses LF endings, one trailing newline and no blank runs', () => {
    expect(built).not.toContain('\r');
    expect(built.endsWith('\n')).toBe(true);
    expect(built.endsWith('\n\n')).toBe(false);
    expect(built).not.toMatch(/\n{3}/);
  });
});

describe('renderLlmsTxt', () => {
  const text = renderLlmsTxt();

  it('links the public pages in both locales', () => {
    for (const path of [
      '/en',
      '/en/projects',
      '/en/accessibility',
      '/pt',
      '/pt/projects',
      '/pt/accessibility',
    ]) {
      expect(text).toContain(`${path})`);
    }
  });

  it('leaks no contact details, admin path or hidden content', () => {
    expect(text).not.toMatch(/@|mailto:|tel:|\/admin|scratch-pad/);
  });
});
