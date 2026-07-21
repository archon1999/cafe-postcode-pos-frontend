// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useHallMapViewport } from './useHallMapViewport';

describe('useHallMapViewport', () => {
  it('exposes a safe viewport size before the map element is measured', () => {
    const { result } = renderHook(() =>
      useHallMapViewport({
        gridColumns: 12,
        isLoading: false,
        selectedHallKey: 'hall-1',
        selectedZoneId: 'zone-1',
        tables: [],
      }),
    );

    expect(result.current.viewportSize).toEqual({ width: 0, height: 0 });
  });
});
