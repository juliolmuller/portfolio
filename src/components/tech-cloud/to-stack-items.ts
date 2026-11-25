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
  // The same objects, not copies: a repeated reference is serialized once in
  // the RSC payload, where a remapped copy would ship every cloud item twice.
  const cloudItems: CloudTech[] = items.filter(isCloudItem);

  return { items, cloudItems };
}
