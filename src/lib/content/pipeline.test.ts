import { createRecordingLogger } from '../../../tests/support/content-logger';
import {
  createRefFilter,
  createSkillFilter,
  createTechFilter,
  fillMissingTranslations,
  stripNulls,
} from './pipeline';

describe('content pipeline', () => {
  it('strips nulls from GROQ results', () => {
    expect(stripNulls({ a: null, b: [1, null, { c: null, d: 'x' }], e: 0 })).toEqual({
      b: [1, { d: 'x' }],
      e: 0,
    });
  });

  it('also fills array items that carry a Sanity _key', () => {
    expect(
      fillMissingTranslations(
        { highlights: [{ _key: 'k1', _type: 'localeString', en: 'One' }] },
        () => {},
      ),
    ).toEqual({
      highlights: [{ _key: 'k1', _type: 'localeString', en: 'One', pt: 'One' }],
    });
  });

  it('fills missing pt values with en and reports the path', () => {
    const paths: string[] = [];
    const result = fillMissingTranslations(
      {
        title: { _type: 'localeString', en: 'Hello', pt: '' },
        list: [{ en: 'One', pt: 'Um' }, { en: 'Two' }],
        other: { en: 'not localized', extra: true },
      },
      (path) => paths.push(path),
    );

    expect(result).toEqual({
      title: { _type: 'localeString', en: 'Hello', pt: 'Hello' },
      list: [
        { en: 'One', pt: 'Um' },
        { en: 'Two', pt: 'Two' },
      ],
      other: { en: 'not localized', extra: true },
    });
    expect(paths).toEqual(['title', 'list[1]']);
  });

  it('keeps visible technology references and reports unknown ones', () => {
    const logger = createRecordingLogger();
    const filter = createTechFilter(
      [{ id: 'a', visible: true }, { id: 'b', visible: false }, { id: 'c' }],
      logger,
    );

    expect(filter('project.x', ['a', 'b', 'c', 'zzz'])).toEqual(['a', 'c']);
    expect(logger.warnings).toEqual([
      {
        event: 'unknown-technology',
        details: { id: 'project.x', techId: 'zzz' },
      },
    ]);
  });

  it('keeps visible references in stored order and ignores malformed refs', () => {
    const logger = createRecordingLogger();
    const filter = createRefFilter(
      [
        null,
        { visible: true },
        'x',
        { id: 'a', visible: true },
        { id: 'b', visible: false },
        { id: 'c' },
      ],
      { event: 'unknown-skill', key: 'skillId' },
      logger,
    );

    expect(filter('project.x', ['c', 'b', 'a', 'zzz'])).toEqual(['c', 'a']);
    expect(logger.warnings).toEqual([
      { event: 'unknown-skill', details: { id: 'project.x', skillId: 'zzz' } },
    ]);
  });

  it('reports unknown skills under the skill event', () => {
    const logger = createRecordingLogger();
    const filter = createSkillFilter([{ id: 'a', visible: true }], logger);

    expect(filter('education.y', ['a', 'nope'])).toEqual(['a']);
    expect(logger.warnings).toEqual([
      { event: 'unknown-skill', details: { id: 'education.y', skillId: 'nope' } },
    ]);
  });
});
