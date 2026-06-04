import type {
  ActiveSession,
  DiningTable,
  Hall,
  TableSession,
  WaiterCreateOrderResponse,
  WaiterMenuCategory,
  WaiterMenuItem,
  WaiterOrder,
  WaiterOrderItem,
  WaiterSessionResponse,
} from 'modules/waiter/domain';

type WaiterMenuItemDto = WaiterMenuItem;
type WaiterMenuCategoryDto = Omit<WaiterMenuCategory, 'items'> & { items: WaiterMenuItemDto[] };
type ActiveSessionDto = ActiveSession & {
  guest_count?: number;
  created_at?: string;
  service_state?: string;
};
type DiningTableDto = Omit<
  DiningTable,
  'activeSession' | 'activeSessions' | 'activeSessionCount' | 'occupiedGuestCount' | 'availableSeatCount'
> & {
  activeSession?: ActiveSessionDto | null;
  active_session?: ActiveSessionDto | null;
  activeSessions?: ActiveSessionDto[];
  active_sessions?: ActiveSessionDto[];
  activeSessionCount?: number;
  active_session_count?: number;
  occupiedGuestCount?: number;
  occupied_guest_count?: number;
  availableSeatCount?: number;
  available_seat_count?: number;
};
type HallDto = Omit<Hall, 'tables'> & { tables: DiningTableDto[] };
type TableSessionDto = TableSession;
type WaiterOrderItemDto = WaiterOrderItem;
type WaiterOrderDto = Omit<WaiterOrder, 'items'> & { items: WaiterOrderItemDto[] };
type WaiterSessionResponseDto = WaiterSessionResponse;
type WaiterCreateOrderResponseDto = WaiterCreateOrderResponse;

export function mapWaiterMenuCategory(dto: WaiterMenuCategoryDto): WaiterMenuCategory {
  return {
    ...dto,
    imageUrl: dto.imageUrl ?? dto.image_url ?? null,
    items: dto.items.map((item) => ({ ...item, imageUrl: item.imageUrl ?? item.image_url ?? null })),
  };
}

export function mapWaiterMenuCategories(dtos: WaiterMenuCategoryDto[]) {
  return dtos.map(mapWaiterMenuCategory);
}

function mapActiveSession(dto: ActiveSessionDto): ActiveSession {
  return {
    ...dto,
    guestCount: dto.guestCount ?? dto.guest_count ?? 0,
    createdAt: dto.createdAt ?? dto.created_at,
    serviceState: dto.serviceState ?? dto.service_state,
  };
}

export function mapHall(dto: HallDto): Hall {
  return {
    ...dto,
    tables: dto.tables.map((table) => ({
      ...table,
      activeSession: table.activeSession
        ? mapActiveSession(table.activeSession)
        : table.active_session
          ? mapActiveSession(table.active_session)
          : null,
      activeSessions: (table.activeSessions ?? table.active_sessions ?? []).map(mapActiveSession),
      activeSessionCount: table.activeSessionCount ?? table.active_session_count ?? 0,
      occupiedGuestCount: table.occupiedGuestCount ?? table.occupied_guest_count ?? 0,
      availableSeatCount: table.availableSeatCount ?? table.available_seat_count ?? table.seatCount,
    })),
  };
}

export function mapHalls(dtos: HallDto[]) {
  return dtos.map(mapHall);
}

export function mapTableSession(dto: TableSessionDto): TableSession {
  return { ...dto };
}

export function mapWaiterOrder(dto: WaiterOrderDto): WaiterOrder {
  return {
    ...dto,
    items: dto.items.map((item) => ({ ...item })),
  };
}

export function mapWaiterOrders(dtos: WaiterOrderDto[]) {
  return dtos.map(mapWaiterOrder);
}

export function mapWaiterSessionResponse(dto: WaiterSessionResponseDto): WaiterSessionResponse {
  return { ...dto };
}

export function mapWaiterCreateOrderResponse(dto: WaiterCreateOrderResponseDto): WaiterCreateOrderResponse {
  return { ...dto };
}
