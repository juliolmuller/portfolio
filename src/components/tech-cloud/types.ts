import { type PublicTechIcon } from '@/lib/content/icon-src';
import { type SkillCategory } from '@/lib/content/taxonomy';

/**
 * A skill as the stack's client components receive it (D59). The first category
 * is the primary one (shown in captions); filters match any of them.
 */
export interface StackItem {
  brandColor?: string;
  categories: SkillCategory[];
  icon?: PublicTechIcon;
  id: string;
  inCloud: boolean;
  name: string;
  priority: 1 | 2 | 3;
  url?: string;
}
