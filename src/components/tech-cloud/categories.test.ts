import { type SkillCategory } from '@/lib/content/taxonomy';

import { countByCategory, matchesCategory } from './categories';

function item(...categories: SkillCategory[]): { categories: SkillCategory[] } {
  return { categories };
}

describe('matchesCategory', () => {
  it('matches every item when no category is active', () => {
    expect(matchesCategory(item('language'), null)).toBe(true);
    expect(matchesCategory(item('language', 'engineering'), null)).toBe(true);
  });

  it('matches an item by its primary or any other category', () => {
    const multi = item('language', 'engineering');

    expect(matchesCategory(multi, 'language')).toBe(true);
    expect(matchesCategory(multi, 'engineering')).toBe(true);
  });

  it('does not match a category the item lacks', () => {
    expect(matchesCategory(item('language', 'engineering'), 'cloud')).toBe(false);
  });
});

describe('countByCategory', () => {
  it('counts an item once under each of its categories', () => {
    const counts = countByCategory([
      item('language', 'engineering'),
      item('language'),
      item('data'),
    ]);

    expect(counts.get('language')).toBe(2);
    expect(counts.get('engineering')).toBe(1);
    expect(counts.get('data')).toBe(1);
  });

  it('leaves out categories without items', () => {
    const counts = countByCategory([item('language')]);

    expect(counts.has('engineering')).toBe(false);
    expect(countByCategory([]).size).toBe(0);
  });
});
