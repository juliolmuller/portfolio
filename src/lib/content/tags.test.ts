import { documentTypes } from './schema';
import { contentTags, tagsForDocument } from './tags';

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
    expect(Object.values(contentTags)).toContain('content:skills');
  });

  it('adds the slug tag of a project', () => {
    expect(tagsForDocument('project', ['orbit-dashboard'])).toEqual([
      contentTags.projects,
      'content:project:orbit-dashboard',
    ]);
  });
});
