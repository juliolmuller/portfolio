/**
 * Pure math for the experience timeline rail. The rail tip eases toward an
 * anchor line (the cursor, or 60% of the viewport) with frame-time scaling so
 * the feel is identical at any refresh rate (D80, reusing D66).
 */
import { ease, frameScale } from '@/lib/tech-cloud/motion';

/**
 * Per-60 Hz-frame lerp factor of the rail tip toward the cursor.
 */
export const RAIL_EASE = 0.12;
/**
 * Viewport fraction used as the anchor when the cursor does not drive the rail.
 */
export const SCROLL_ANCHOR = 0.6;
/**
 * Within this many px of the target the tip snaps, so the rAF loop can stop.
 */
export const SETTLE_PX = 0.5;

export function railProgress({
  anchorY,
  top,
  height,
}: {
  anchorY: number;
  height: number;
  top: number;
}): number {
  if (!(height > 0)) return 0;

  const value = (anchorY - top) / height;

  if (Number.isNaN(value)) return 0;

  return Math.min(1, Math.max(0, value));
}

export function easeToward(
  current: number,
  target: number,
  gapMs: number,
  factor = RAIL_EASE,
): number {
  const next = current + (target - current) * ease(factor, frameScale(gapMs));

  return Math.abs(target - next) < SETTLE_PX ? target : next;
}

export function isInside(
  rect: { bottom: number; left: number; right: number; top: number },
  x: number,
  y: number,
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
