import { splitParagraphs, truncateAtWord } from './format';

describe('splitParagraphs', () => {
  it.each([
    ['a\n\nb', ['a', 'b']],
    ['a\nb', ['a\nb']],
    ['a\r\n\r\nb', ['a', 'b']],
    ['a\r\rb', ['a', 'b']],
    ['a\r\nb', ['a\nb']],
    ['a\n\n\n\nb', ['a', 'b']],
    ['\n\n a \n\n', ['a']],
    ['a\n   \nb', ['a', 'b']],
    ['só uma linha', ['só uma linha']],
    ['', []],
    ['\n\n', []],
  ])('%j → %j', (input, expected) => {
    expect(splitParagraphs(input)).toEqual(expected);
  });
});

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
