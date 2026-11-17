import { documentTypes } from './schema';
import { contentTags, tagsForDocument } from './tags';

describe('tagsForDocument', () => {
  it('answers every document type with content tags', () => {
    for (const type of documentTypes) {
      for (const tag of tagsForDocument(type)) expect(tag, type).toMatch(/^content:/);
    }
  });

  it('adds the slug tag of a project', () => {
    expect(tagsForDocument('project', ['orbit-dashboard'])).toEqual([
      contentTags.projects,
      'content:project:orbit-dashboard',
    ]);
  });
});
