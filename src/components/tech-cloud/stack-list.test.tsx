import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { skillCategories, type SkillCategory } from '@/lib/content/taxonomy';

import { StackList } from './stack-list';
import { type StackItem } from './types';

vi.mock('@/components/ui/reveal', () => ({
  Reveal: ({ children }: { children?: React.ReactNode }): React.JSX.Element => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/content/tech-icon', () => ({
  TechIcon: (): React.JSX.Element => <svg />,
}));

const categoryLabels = Object.fromEntries(
  skillCategories.map((key) => [key, `label-${key}`]),
) as Record<SkillCategory, string>;

function tech(id: string, categories: SkillCategory[]): StackItem {
  return { id, name: id, categories, icon: { monogram: 'x' }, inCloud: true, priority: 1 };
}

function render(items: StackItem[]): string {
  return renderToStaticMarkup(<StackList items={items} categoryLabels={categoryLabels} />);
}

function listOf(html: string, category: SkillCategory): string {
  const match = new RegExp(`aria-labelledby="stack-${category}"[^>]*>(.*?)</ul>`).exec(html);

  return match?.[1] ?? '';
}

describe('StackList categories (#69)', () => {
  it('renders a single-category item under exactly one heading', () => {
    const html = render([tech('ts', ['language'])]);

    expect(html.match(/<h3/g)).toHaveLength(1);
    expect(html).toContain('id="stack-language"');
    expect(html).toContain('<span class="tabular-nums">1</span>');
  });

  it('lists a multi-category item under each of its categories', () => {
    const html = render([tech('ts', ['language', 'engineering']), tech('go', ['language'])]);

    expect(listOf(html, 'language')).toContain('<span>ts</span>');
    expect(listOf(html, 'language')).toContain('<span>go</span>');
    expect(listOf(html, 'engineering')).toContain('<span>ts</span>');
    expect(listOf(html, 'engineering')).not.toContain('<span>go</span>');
  });

  it('renders no heading for categories without items', () => {
    const html = render([tech('ts', ['language'])]);

    expect(html).not.toContain('stack-engineering');
  });

  it('renders an icon-less item by name only, aligned with icon rows (#74)', () => {
    const bare: StackItem = {
      id: 'bare',
      name: 'bare',
      categories: ['language'],
      inCloud: false,
      priority: 1,
    };
    const html = render([tech('ts', ['language']), bare]);

    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain('<span class="ps-7.5">bare</span>');
  });

  it('does not indent a group where no item has an icon (#74)', () => {
    const bare = (id: string): StackItem => ({
      id,
      name: id,
      categories: ['engineering'],
      inCloud: false,
      priority: 1,
    });
    const html = render([bare('solid'), bare('ci-cd'), tech('ts', ['language'])]);

    expect(listOf(html, 'engineering')).not.toContain('ps-7.5');
    expect(listOf(html, 'engineering')).toContain('<span>solid</span>');
  });

  it('never renders a practices block (#74)', () => {
    expect(render([tech('ts', ['engineering'])])).not.toContain('stack-practices');
  });

  it('follows the skillCategories order', () => {
    const html = render([tech('a', ['engineering']), tech('b', ['language'])]);

    expect(html.indexOf('stack-language')).toBeLessThan(html.indexOf('stack-engineering'));
  });
});
