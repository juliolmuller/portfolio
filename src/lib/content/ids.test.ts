import { fixtureId } from './fixtures/ids';
import { derivedId } from './ids';

const TECHNOLOGY_TYPESCRIPT = 'technology.5441c54a-4c84-5a06-acf0-75903499a6ca';
const PRACTICE_SOLID = 'practice.20fb390e-59e4-5645-a67d-157cd3655f59';

describe('derivedId', () => {
  it('keeps the fixture ids stable (golden values)', () => {
    expect(fixtureId('technology', 'TypeScript')).toBe(TECHNOLOGY_TYPESCRIPT);
    expect(fixtureId('practice', 'SOLID')).toBe(PRACTICE_SOLID);
    expect(derivedId('technology', 'TypeScript')).toBe(TECHNOLOGY_TYPESCRIPT);
    expect(derivedId('practice', 'SOLID')).toBe(PRACTICE_SOLID);
  });

  it('produces a typed v5-style uuid for skills', () => {
    expect(derivedId('skill', 'technology.abc')).toMatch(
      /^skill\.[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('gives different ids to different types with the same key', () => {
    expect(derivedId('skill', 'x')).not.toBe(derivedId('technology', 'x'));
  });

  it('only accepts document types and skill (checked by typecheck)', () => {
    // @ts-expect-error 'skil' is neither a document type nor 'skill'
    expect(derivedId('skil', 'x')).toMatch(/^skil\./);
  });
});
