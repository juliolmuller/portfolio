import { toPublicIcon } from '@/lib/content/icon-src';
import { type Skill } from '@/lib/content/types';

import { type CloudTech } from './geoid-sphere';
import { type StackItem } from './types';

function isCloudItem(item: StackItem): item is Pick<CloudTech, 'icon'> & StackItem {
  return item.inCloud && item.icon !== undefined;
}

/**
 * Splits skills into the List view's items (every visible skill) and the
 * geoid's (only `inCloud` ones with an icon). Only icon URLs leave the server
 * (D59); input order is kept.
 */
export function toStackItems(skills: readonly Skill[]): {
  cloudItems: CloudTech[];
  items: StackItem[];
} {
  const items = skills.map((skill): StackItem => ({
    id: skill.id,
    name: skill.name,
    categories: skill.categories,
    ...(skill.icon ? { icon: toPublicIcon(skill.icon) } : {}),
    inCloud: skill.inCloud,
    brandColor: skill.brandColor,
    url: skill.url,
    priority: skill.priority,
  }));
  const cloudItems = items.filter(isCloudItem).map((item): CloudTech => ({
    id: item.id,
    name: item.name,
    categories: item.categories,
    icon: item.icon,
    brandColor: item.brandColor,
    url: item.url,
    priority: item.priority,
  }));

  return { items, cloudItems };
}
