import { updateTag } from 'next/cache';

import { revalidateEverything } from '@/lib/admin/hooks';

import { documentTypes } from './schema';
import { contentTags, tagsForDocument } from './tags';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

describe('tagsForDocument', () => {
  it('answers every document type with content tags', () => {
    for (const type of documentTypes) {
      for (const tag of tagsForDocument(type)) expect(tag, type).toMatch(/^content:/);
    }
  });

  it('maps skill changes to the skills tag', () => {
    expect(tagsForDocument('skill')).toEqual([contentTags.skills]);
  });

  it('covers skills in revalidate-all', () => {
    revalidateEverything();

    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(contentTags.skills);
  });

  it('adds the slug tag of a project', () => {
    expect(tagsForDocument('project', ['orbit-dashboard'])).toEqual([
      contentTags.projects,
      'content:project:orbit-dashboard',
    ]);
  });
});
