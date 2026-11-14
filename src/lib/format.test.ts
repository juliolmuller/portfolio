import { splitParagraphs } from './format';

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
