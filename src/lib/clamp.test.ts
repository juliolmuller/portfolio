import { isClamped } from './clamp';

describe('isClamped', () => {
  it('is false when the text fits', () => {
    expect(isClamped(96, 96)).toBe(false);
    expect(isClamped(0, 0)).toBe(false);
  });

  it('ignores a pixel of rounding', () => {
    expect(isClamped(97, 96)).toBe(false);
    expect(isClamped(96.5, 96)).toBe(false);
  });

  it('is true once the text overflows by more than the tolerance', () => {
    expect(isClamped(98, 96)).toBe(true);
  });
});
