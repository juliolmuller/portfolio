import { deviconPlainIcon } from '@/lib/content/icons/resolve';

import { lucideIconExists, searchIcons } from './icons';

describe('admin icon search', () => {
  it('offers linkedin from the plain Devicon set', async () => {
    const hits = await searchIcons('devicon-plain', 'linkedin');

    expect(hits.map((hit) => hit.slug)).toContain('linkedin');
  });

  it('lists only names that render from the plain set', async () => {
    const hits = await searchIcons('devicon-plain', 'a');

    expect(hits.length).toBeGreaterThan(0);

    for (const hit of hits) {
      expect(await deviconPlainIcon(hit.slug), hit.slug).not.toBeNull();
    }
  });

  it('checks Lucide names', () => {
    expect(lucideIconExists('rss')).toBe(true);
    expect(lucideIconExists('briefcase-business')).toBe(true);
    expect(lucideIconExists('nope-x')).toBe(false);
  });
});
