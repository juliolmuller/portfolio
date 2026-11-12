import { describe, expect, it } from 'vitest';

import { easeToward, isInside, railProgress, SETTLE_PX } from './timeline-rail';

describe('railProgress', () => {
  it('clamps to 0 and 1', () => {
    expect(railProgress({ anchorY: -50, top: 0, height: 100 })).toBe(0);
    expect(railProgress({ anchorY: 500, top: 0, height: 100 })).toBe(1);
  });

  it('returns an exact intermediate value', () => {
    expect(railProgress({ anchorY: 150, top: 100, height: 200 })).toBe(0.25);
  });

  it('is 0 for a zero height without NaN or Infinity', () => {
    expect(railProgress({ anchorY: 10, top: 0, height: 0 })).toBe(0);
    expect(railProgress({ anchorY: Number.NaN, top: 0, height: 10 })).toBe(0);
  });

  it('grows monotonically with the anchor', () => {
    let previous = -1;

    for (let y = -10; y <= 210; y += 10) {
      const value = railProgress({ anchorY: y, top: 0, height: 200 });

      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('easeToward', () => {
  function simulate(hz: number, ms: number): number {
    let value = 0;

    for (let t = 0; t < ms; t += 1000 / hz) value = easeToward(value, 400, 1000 / hz);

    return value;
  }

  it('converges to the target', () => {
    expect(simulate(60, 2000)).toBe(400);
  });

  it('snaps within the settle distance', () => {
    expect(easeToward(399.8, 400, 16)).toBe(400);
    expect(SETTLE_PX).toBeGreaterThan(0);
  });

  it('is refresh-rate independent', () => {
    const base = simulate(60, 500);

    for (const hz of [120, 144]) expect(Math.abs(simulate(hz, 500) - base)).toBeLessThan(5);
  });

  it('caps a stalled frame at 50 ms', () => {
    expect(easeToward(0, 1000, 5000)).toBe(easeToward(0, 1000, 50));
  });

  it('does not move on a zero or negative gap', () => {
    expect(easeToward(0, 1000, 0)).toBe(0);
    expect(easeToward(0, 1000, -10)).toBe(0);
  });
});

describe('isInside', () => {
  const rect = { top: 10, bottom: 20, left: 30, right: 40 };

  it('is inclusive on the edges', () => {
    expect(isInside(rect, 30, 10)).toBe(true);
    expect(isInside(rect, 40, 20)).toBe(true);
  });

  it('is false outside on each side', () => {
    expect(isInside(rect, 29, 15)).toBe(false);
    expect(isInside(rect, 41, 15)).toBe(false);
    expect(isInside(rect, 35, 9)).toBe(false);
    expect(isInside(rect, 35, 21)).toBe(false);
  });
});
