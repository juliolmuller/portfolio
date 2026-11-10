import { truncateAtWord } from './format';

describe('truncateAtWord', () => {
  it('returns null when the text fits', () => {
    expect(truncateAtWord('short', 10)).toBeNull();
    expect(truncateAtWord('x'.repeat(10), 10)).toBeNull();
  });

  it('cuts at the last word boundary and drops trailing punctuation', () => {
    expect(truncateAtWord('one two, three four', 12)).toBe('one two');
    expect(truncateAtWord('one two three', 7)).toBe('one two');
  });

  it('hard-cuts a single long word', () => {
    expect(truncateAtWord('x'.repeat(20), 8)).toBe('x'.repeat(8));
  });

  it('treats a negative limit as zero', () => {
    expect(truncateAtWord('abc', -2)).toBe('');
  });
});
