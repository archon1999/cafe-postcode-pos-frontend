import type { PosServiceFeeComponent } from 'shared/pos/service-fees';

export type ActiveSessionServiceState = 'new' | 'cooking' | 'done' | 'pending_payment' | string;
export type DiningTableStatus = 'available' | 'occupied' | 'reserved' | 'blocked';
export type DiningTableShapeVariant =
  | 'seat2_horizontal'
  | 'seat2_vertical'
  | 'seat3_triangle'
  | 'seat4_square'
  | 'seat4_horizontal'
  | 'seat4_vertical'
  | 'seat5_horizontal'
  | 'seat5_vertical'
  | 'seat6_horizontal'
  | 'seat6_vertical';

export type ActiveSession = {
  id: string;
  guestCount: number;
  status: string;
  createdAt?: string;
  serviceState?: ActiveSessionServiceState;
  primaryTableId?: string;
  tableIds?: string[];
  tableNumbers?: number[];
};

export type HallZone = {
  id: string;
  name: string;
  isPrivate?: boolean;
  sortOrder?: number;
  isActive?: boolean;
};

export type DiningTable = {
  id: string;
  name: string;
  zone?: string | null;
  zoneName?: string | null;
  zoneIsPrivate?: boolean | null;
  tableNumber: number;
  seatCount: number;
  status: DiningTableStatus;
  shape?: string;
  shapeVariant?: DiningTableShapeVariant;
  positionX?: number | string;
  positionY?: number | string;
  width?: number | string;
  height?: number | string;
  rotation?: number | string;
  activeSession?: ActiveSession | null;
  activeSessions?: ActiveSession[];
  activeSessionCount?: number;
  occupiedGuestCount?: number;
  availableSeatCount?: number;
};

export type Hall = {
  id: string;
  name: string;
  level?: number | string;
  gridColumns?: number | string;
  zones?: HallZone[];
  tables: DiningTable[];
};

export type TableSession = {
  id: string;
  tableName: string;
  tableNumber?: number;
  hallName: string;
  zoneName?: string | null;
  showZoneName?: boolean;
  guestCount: number;
  status: string;
  assignedWaiterName?: string | null;
  openedAt?: string | null;
  serviceFeePercent?: number | string;
  serviceFeeComponents?: PosServiceFeeComponent[];
  tables?: Array<{
    id: string;
    name: string;
    tableNumber: number;
    hallId: string;
    isPrimary: boolean;
  }>;
  groupTableCount?: number;
};

export type WaiterSessionResponse = {
  id: string;
};

export type TableOperationResponse = {
  mode: 'moved' | 'merged' | 'grouped' | 'ungrouped';
  session: TableSession;
  tableIds?: string[];
  releasedTableIds?: string[];
};
