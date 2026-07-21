// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  HALL_MAP_MAX_SCALE,
  HALL_MAP_STORAGE_KEY,
  calculateHallMapFillScale,
  clampMapScale,
  readHallMapScaleSettings,
} from './hallMapScale';

describe('hall map scale', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps the manual zoom maximum at 160 percent', () => {
    expect(clampMapScale(2.4)).toBe(HALL_MAP_MAX_SCALE);
  });

  it('allows fill mode to exceed the manual maximum and occupy the viewport width', () => {
    expect(calculateHallMapFillScale(1920, 700)).toBeCloseTo((1920 - 28) / 700);
    expect(calculateHallMapFillScale(1920, 700)).toBeGreaterThan(HALL_MAP_MAX_SCALE);
  });

  it('restores an automatic scale above the manual maximum', () => {
    window.localStorage.setItem(HALL_MAP_STORAGE_KEY, JSON.stringify({ mode: 'fill', scale: 2.7 }));

    expect(readHallMapScaleSettings()).toEqual({ mode: 'fill', scale: 2.7 });
  });
});
