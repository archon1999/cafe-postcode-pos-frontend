import { describe, expect, it } from 'vitest';

import type { DiningTable, Hall } from '../entities';

import {
  getAvailableSeatCount,
  getHallGridColumns,
  getHallGridRows,
  getSupportedSeatCount,
  getTableCoreShape,
  getTableGridPlacement,
  getTableMeta,
  getTableVisualState,
  getVariantMarkers,
} from './hall-layout';

function createTable(overrides: Partial<DiningTable> = {}): DiningTable {
  return {
    id: 'table-1',
    name: 'Table 1',
    tableNumber: 1,
    seatCount: 4,
    status: 'available',
    shapeVariant: 'seat4_square',
    positionX: 0,
    positionY: 0,
    width: 1,
    height: 1,
    rotation: 0,
    activeSession: null,
    ...overrides,
  };
}

describe('waiter hall layout utils', () => {
  it('normalizes seat counts into constructor-supported shapes', () => {
    expect(getSupportedSeatCount(1)).toBe(2);
    expect(getSupportedSeatCount(3)).toBe(3);
    expect(getSupportedSeatCount(4)).toBe(4);
    expect(getSupportedSeatCount(5)).toBe(5);
    expect(getSupportedSeatCount(9)).toBe(6);
  });

  it('derives available seats from multi-session table counters', () => {
    expect(getAvailableSeatCount(createTable({ seatCount: 4, occupiedGuestCount: 3 }))).toBe(1);
    expect(getAvailableSeatCount(createTable({ seatCount: 4, availableSeatCount: 2 }))).toBe(2);
    expect(
      getAvailableSeatCount(
        createTable({
          seatCount: 4,
          activeSession: {
            id: 'session-1',
            guestCount: 2,
            status: 'open',
          },
        }),
      ),
    ).toBe(0);
  });

  it('derives visual state from active service state before static table status', () => {
    expect(
      getTableVisualState(
        createTable({
          activeSession: {
            id: 'session-1',
            guestCount: 2,
            status: 'open',
            serviceState: 'new',
            createdAt: '2026-03-26T09:00:00Z',
          },
        }),
      ),
    ).toBe('attention');

    expect(
      getTableVisualState(
        createTable({
          status: 'reserved',
          activeSession: {
            id: 'session-2',
            guestCount: 2,
            status: 'open',
            serviceState: 'cooking',
            createdAt: '2026-03-26T09:00:00Z',
          },
        }),
      ),
    ).toBe('cooking');
  });

  it('builds hall grid metrics from constructor coordinates', () => {
    const hall: Hall = {
      id: 'hall-1',
      name: 'Main Hall',
      gridColumns: 10,
      tables: [
        createTable({ id: 'table-1', positionX: 0, positionY: 0, width: 1, height: 1 }),
        createTable({ id: 'table-2', tableNumber: 2, positionX: 6, positionY: 2, width: 2, height: 2 }),
      ],
    };

    expect(getHallGridColumns(hall)).toBe(10);
    expect(getHallGridRows(hall)).toBe(4);
    expect(getTableGridPlacement(hall.tables[1], 10)).toEqual({
      positionX: 6,
      positionY: 2,
      width: 2,
      height: 2,
    });
  });

  it('maps table variants to core shape and markers', () => {
    expect(getTableCoreShape('seat4_vertical')).toBe('vertical');
    expect(getTableCoreShape('seat6_horizontal')).toBe('horizontal');
    expect(getTableCoreShape('seat3_triangle')).toBe('triangle');
    expect(getVariantMarkers('seat4_square')).toHaveLength(4);
    expect(getVariantMarkers('seat6_vertical')).toHaveLength(6);
  });

  it('builds table meta labels for blocked and cooking states', () => {
    const copy = {
      reservedShort: 'RES',
      blockedShort: 'BLK',
    };

    expect(
      getTableMeta(
        createTable({
          status: 'blocked',
        }),
        copy,
        () => '15m',
      ),
    ).toBe('BLK');

    expect(
      getTableMeta(
        createTable({
          activeSession: {
            id: 'session-3',
            guestCount: 2,
            status: 'open',
            serviceState: 'cooking',
            createdAt: '2026-03-26T09:00:00Z',
          },
        }),
        copy,
        () => '15m',
      ),
    ).toBe('15m');
  });
});
