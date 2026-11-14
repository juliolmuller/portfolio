/**
 * Whether text is cut by a CSS line clamp. The tolerance absorbs sub-pixel
 * rounding, so text that exactly fits never reports as clamped.
 */
export function isClamped(scrollHeight: number, clientHeight: number, tolerance = 1): boolean {
  return scrollHeight - clientHeight > tolerance;
}
