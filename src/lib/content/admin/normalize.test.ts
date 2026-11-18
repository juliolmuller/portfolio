import { describe, expect, it } from 'vitest';

import { pruneEmpty, toFieldErrors } from './normalize';

const issue = (
  code: string,
  extra: { maximum?: number; minimum?: number },
): Parameters<typeof toFieldErrors>[0][number] => ({
  code,
  origin: 'array',
  path: ['categories'],
  message: '',
  ...extra,
});

describe('toFieldErrors', () => {
  it('singularizes array size messages', () => {
    const errors = (item: ReturnType<typeof issue>): string | undefined =>
      toFieldErrors([item]).fieldErrors['categories'];

    expect(errors(issue('too_small', { minimum: 1 }))).toBe('At least 1 item');
    expect(errors(issue('too_small', { minimum: 2 }))).toBe('At least 2 items');
    expect(errors(issue('too_big', { maximum: 1 }))).toBe('At most 1 item');
    expect(errors(issue('too_big', { maximum: 8 }))).toBe('At most 8 items');
  });
});

describe('pruneEmpty', () => {
  it('drops blank strings and keeps empty arrays', () => {
    expect(pruneEmpty({ url: '  ', categories: [] })).toEqual({ categories: [] });
  });
});
