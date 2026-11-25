import { TechIcon } from '@/components/content/tech-icon';
import { Reveal } from '@/components/ui/reveal';
import { skillCategories, type SkillCategory } from '@/lib/content/taxonomy';

import { matchesCategory } from './categories';
import { type StackItem } from './types';

export function StackList({
  items,
  categoryLabels,
}: {
  categoryLabels: Record<SkillCategory, string>;
  items: StackItem[];
}): React.JSX.Element {
  const groups = skillCategories
    .map((category) => {
      const members = items.filter((item) => matchesCategory(item, category));

      return {
        category,
        items: members,
        // Icon-less rows only need the indent next to rows that have an icon.
        hasIcons: members.some((item) => item.icon !== undefined),
      };
    })
    .filter((group) => group.items.length > 0);

  return (
    <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group, index) => (
        <Reveal key={group.category} index={index % 3}>
          <h3
            id={`stack-${group.category}`}
            className="flex items-baseline gap-2 font-label text-text-3"
          >
            {categoryLabels[group.category]}
            <span className="tabular-nums">{group.items.length}</span>
          </h3>
          <ul
            aria-labelledby={`stack-${group.category}`}
            className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"
          >
            {group.items.map((item) => (
              <li
                key={item.id}
                className="flex min-w-0 items-center gap-2.5 text-[0.9375rem] text-text-1"
              >
                {item.icon ? <TechIcon icon={item.icon} className="text-text-2" /> : null}
                {/* ps-7.5 = the icon's size-5 + this row's gap-2.5: keep them in sync. */}
                <span className={!item.icon && group.hasIcons ? 'ps-7.5' : undefined}>
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      ))}
    </div>
  );
}
