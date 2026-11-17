import { type PublicTechIcon } from '@/lib/content/icon-src';
import { type SkillCategory } from '@/lib/content/taxonomy';
import { type Technology } from '@/lib/content/types';

/**
 * A technology as the stack's client components receive it (D59). The first
 * category is the primary one (shown in captions); filters match any of them.
 */
export type StackTech = {
  categories: SkillCategory[];
  icon: PublicTechIcon;
} & Omit<Technology, 'category' | 'icon' | 'order'>;
