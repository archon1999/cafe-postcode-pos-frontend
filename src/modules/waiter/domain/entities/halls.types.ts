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
  hallName: string;
  guestCount: number;
  status: string;
  assignedWaiterName?: string | null;
};

export type WaiterSessionResponse = {
  id: string;
};
