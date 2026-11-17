import { type SkillCategory } from '@/lib/content/taxonomy';

interface Categorized {
  categories: readonly SkillCategory[];
}

/**
 * Whether an item belongs to the active filter: any of its categories counts
 * and no filter (`null`) matches everything (D44).
 */
export function matchesCategory(item: Categorized, category: null | SkillCategory): boolean {
  return category === null || item.categories.includes(category);
}

/**
 * Items per category; an item counts once under each of its categories.
 */
export function countByCategory(items: readonly Categorized[]): Map<SkillCategory, number> {
  const counts = new Map<SkillCategory, number>();

  for (const item of items) {
    for (const category of item.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  return counts;
}
