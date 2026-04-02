import type { DiningTable, DiningTableShapeVariant, DiningTableStatus, Hall } from '../entities';

export type SupportedSeatCount = 2 | 3 | 4 | 5 | 6;
export type TableVisualState =
  | 'available'
  | 'reserved'
  | 'occupied'
  | 'attention'
  | 'cooking'
  | 'pending_payment'
  | 'blocked';
export type TableCoreShape = 'square' | 'horizontal' | 'vertical' | 'triangle';

export type SeatMarker = {
  key: string;
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
  width?: number | string;
  height?: number | string;
  transform?: string;
};

export type TableGridPlacement = {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export function toNumeric(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSupportedSeatCount(seatCount: number): SupportedSeatCount {
  if (seatCount <= 2) {
    return 2;
  }

  if (seatCount === 3) {
    return 3;
  }

  if (seatCount === 4) {
    return 4;
  }

  if (seatCount === 5) {
    return 5;
  }

  return 6;
}

export function clampGuestCount(value: number, seatCount: number) {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : 1;
  return Math.min(Math.max(normalized, 1), getSupportedSeatCount(seatCount));
}

export function getTableStatus(table: DiningTable): DiningTableStatus {
  return table.activeSession ? 'occupied' : table.status;
}

export function getTableVisualState(table: DiningTable): TableVisualState {
  if (table.activeSession?.status === 'pending_payment' || table.activeSession?.serviceState === 'pending_payment') {
    return 'pending_payment';
  }

  if (table.activeSession?.serviceState === 'cooking') {
    return 'cooking';
  }

  if (table.activeSession?.serviceState === 'new') {
    return 'attention';
  }

  if (table.activeSession) {
    return 'occupied';
  }

  if (table.status === 'reserved') {
    return 'reserved';
  }

  if (table.status === 'blocked') {
    return 'blocked';
  }

  return 'available';
}

export function shouldShowAttentionDot(table: DiningTable) {
  return table.activeSession?.serviceState === 'new';
}

export function getTableMeta(
  table: DiningTable,
  copy: {
    reservedShort: string;
    blockedShort: string;
  },
  formatElapsedMinutes: (value?: string) => string,
) {
  if (table.activeSession?.status === 'pending_payment' || table.activeSession?.serviceState === 'pending_payment') {
    return '';
  }

  if (table.activeSession?.serviceState === 'cooking') {
    return formatElapsedMinutes(table.activeSession.createdAt);
  }

  if (table.status === 'reserved') {
    return copy.reservedShort;
  }

  if (table.status === 'blocked') {
    return copy.blockedShort;
  }

  return '';
}

export function getHallGridColumns(hall: Hall | undefined) {
  return Math.max(1, Math.trunc(toNumeric(hall?.gridColumns, 8)) || 8);
}

export function getHallGridRows(hall: Hall | undefined) {
  const tables = hall?.tables ?? [];
  const maxRows = tables.reduce((max, table) => {
    const placement = getTableGridPlacement(table, getHallGridColumns(hall));
    return Math.max(max, placement.positionY + placement.height);
  }, 0);

  return Math.max(maxRows, 4);
}

export function getTableGridPlacement(table: DiningTable, gridColumns: number): TableGridPlacement {
  const width = Math.min(Math.max(1, Math.trunc(toNumeric(table.width, 1))), gridColumns);
  const height = Math.max(1, Math.trunc(toNumeric(table.height, 1)));
  const positionX = Math.max(0, Math.min(Math.trunc(toNumeric(table.positionX, 0)), Math.max(gridColumns - width, 0)));
  const positionY = Math.max(0, Math.trunc(toNumeric(table.positionY, 0)));

  return {
    positionX,
    positionY,
    width,
    height,
  };
}

export function getTableCoreShape(shapeVariant?: DiningTableShapeVariant): TableCoreShape {
  if (shapeVariant === 'seat3_triangle') {
    return 'triangle';
  }

  if (shapeVariant?.endsWith('_vertical')) {
    return 'vertical';
  }

  if (shapeVariant?.endsWith('_horizontal')) {
    return 'horizontal';
  }

  return 'square';
}

export function getVariantMarkers(shapeVariant?: DiningTableShapeVariant): SeatMarker[] {
  switch (shapeVariant) {
    case 'seat2_vertical':
      return [
        { key: 'top', top: 5, left: '50%', width: 34, height: 8, transform: 'translateX(-50%)' },
        { key: 'bottom', bottom: 5, left: '50%', width: 34, height: 8, transform: 'translateX(-50%)' },
      ];
    case 'seat3_triangle':
      return [
        { key: 'left', top: '54%', left: 10, width: 8, height: 32, transform: 'translateY(-50%)' },
        { key: 'right', top: '54%', right: 10, width: 8, height: 32, transform: 'translateY(-50%)' },
        { key: 'bottom', bottom: 10, left: '50%', width: 34, height: 8, transform: 'translateX(-50%)' },
      ];
    case 'seat4_horizontal':
      return [
        { key: 'top-left', top: 10, left: '26%', width: 26, height: 8, transform: 'translateX(-50%)' },
        { key: 'top-right', top: 10, left: '74%', width: 26, height: 8, transform: 'translateX(-50%)' },
        { key: 'bottom-left', bottom: 10, left: '26%', width: 26, height: 8, transform: 'translateX(-50%)' },
        { key: 'bottom-right', bottom: 10, left: '74%', width: 26, height: 8, transform: 'translateX(-50%)' },
      ];
    case 'seat4_vertical':
      return [
        { key: 'left-top', top: '28%', left: 10, width: 8, height: 24, transform: 'translateY(-50%)' },
        { key: 'left-bottom', top: '72%', left: 10, width: 8, height: 24, transform: 'translateY(-50%)' },
        { key: 'right-top', top: '28%', right: 10, width: 8, height: 24, transform: 'translateY(-50%)' },
        { key: 'right-bottom', top: '72%', right: 10, width: 8, height: 24, transform: 'translateY(-50%)' },
      ];
    case 'seat5_horizontal':
      return [
        { key: 'top-left', top: 10, left: '28%', width: 22, height: 8, transform: 'translateX(-50%)' },
        { key: 'top-right', top: 10, left: '72%', width: 22, height: 8, transform: 'translateX(-50%)' },
        { key: 'left', top: '50%', left: 10, width: 8, height: 24, transform: 'translateY(-50%)' },
        { key: 'right', top: '50%', right: 10, width: 8, height: 24, transform: 'translateY(-50%)' },
        { key: 'bottom', bottom: 10, left: '50%', width: 28, height: 8, transform: 'translateX(-50%)' },
      ];
    case 'seat5_vertical':
      return [
        { key: 'left-top', top: '30%', left: 10, width: 8, height: 20, transform: 'translateY(-50%)' },
        { key: 'left-bottom', top: '70%', left: 10, width: 8, height: 20, transform: 'translateY(-50%)' },
        { key: 'top', top: 10, left: '50%', width: 22, height: 8, transform: 'translateX(-50%)' },
        { key: 'bottom', bottom: 10, left: '50%', width: 22, height: 8, transform: 'translateX(-50%)' },
        { key: 'right', top: '50%', right: 10, width: 8, height: 26, transform: 'translateY(-50%)' },
      ];
    case 'seat6_horizontal':
      return [
        { key: 'top-left', top: 10, left: '24%', width: 18, height: 8, transform: 'translateX(-50%)' },
        { key: 'top-center', top: 10, left: '50%', width: 18, height: 8, transform: 'translateX(-50%)' },
        { key: 'top-right', top: 10, left: '76%', width: 18, height: 8, transform: 'translateX(-50%)' },
        { key: 'bottom-left', bottom: 10, left: '24%', width: 18, height: 8, transform: 'translateX(-50%)' },
        { key: 'bottom-center', bottom: 10, left: '50%', width: 18, height: 8, transform: 'translateX(-50%)' },
        { key: 'bottom-right', bottom: 10, left: '76%', width: 18, height: 8, transform: 'translateX(-50%)' },
      ];
    case 'seat6_vertical':
      return [
        { key: 'left-top', top: '24%', left: 10, width: 8, height: 18, transform: 'translateY(-50%)' },
        { key: 'left-middle', top: '50%', left: 10, width: 8, height: 18, transform: 'translateY(-50%)' },
        { key: 'left-bottom', top: '76%', left: 10, width: 8, height: 18, transform: 'translateY(-50%)' },
        { key: 'right-top', top: '24%', right: 10, width: 8, height: 18, transform: 'translateY(-50%)' },
        { key: 'right-middle', top: '50%', right: 10, width: 8, height: 18, transform: 'translateY(-50%)' },
        { key: 'right-bottom', top: '76%', right: 10, width: 8, height: 18, transform: 'translateY(-50%)' },
      ];
    case 'seat4_square':
      return [
        { key: 'top', top: 10, left: '50%', width: 28, height: 8, transform: 'translateX(-50%)' },
        { key: 'bottom', bottom: 10, left: '50%', width: 28, height: 8, transform: 'translateX(-50%)' },
        { key: 'left', top: '50%', left: 10, width: 8, height: 30, transform: 'translateY(-50%)' },
        { key: 'right', top: '50%', right: 10, width: 8, height: 30, transform: 'translateY(-50%)' },
      ];
    case 'seat2_horizontal':
    default:
      return [
        { key: 'left', top: '50%', left: 10, width: 8, height: 30, transform: 'translateY(-50%)' },
        { key: 'right', top: '50%', right: 10, width: 8, height: 30, transform: 'translateY(-50%)' },
      ];
  }
}
