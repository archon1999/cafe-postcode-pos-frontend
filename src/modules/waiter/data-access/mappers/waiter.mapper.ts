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
import { mapPosModifierGroups, mapPosOrderItemModifiers } from 'shared/pos/modifiers';

type WaiterMenuItemDto = WaiterMenuItem & {
  image_url?: string | null;
  sale_unit?: 'piece' | 'kg';
  modifier_groups?: Parameters<typeof mapPosModifierGroups>[0];
};
type WaiterMenuCategoryDto = Omit<WaiterMenuCategory, 'items'> & {
  image_url?: string | null;
  items: WaiterMenuItemDto[];
};
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
type TableSessionDto = Omit<TableSession, 'tableNumber'> & {
  tableNumber?: number;
  table_number?: number;
  zone_name?: string | null;
  show_zone_name?: boolean;
};
type WaiterOrderItemDto = WaiterOrderItem & {
  base_unit_price?: number | string;
  unit_price?: number | string;
  sale_unit?: 'piece' | 'kg';
  modifiers?: Parameters<typeof mapPosOrderItemModifiers>[0];
};
type WaiterOrderDto = Omit<WaiterOrder, 'items' | 'displayName'> & {
  items: WaiterOrderItemDto[];
  displayName?: string | null;
  display_name?: string | null;
};
type WaiterSessionResponseDto = WaiterSessionResponse;
type WaiterCreateOrderResponseDto = WaiterCreateOrderResponse;

export function mapWaiterMenuCategory(dto: WaiterMenuCategoryDto): WaiterMenuCategory {
  return {
    ...dto,
    imageUrl: dto.imageUrl ?? dto.image_url ?? null,
    items: dto.items.map((item) => ({
      ...item,
      imageUrl: item.imageUrl ?? item.image_url ?? null,
      saleUnit: item.saleUnit ?? item.sale_unit ?? 'piece',
      modifierGroups: mapPosModifierGroups(item.modifierGroups ?? item.modifier_groups),
    })),
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
  return {
    ...dto,
    tableNumber: dto.tableNumber ?? dto.table_number,
    zoneName: dto.zoneName ?? dto.zone_name ?? null,
    showZoneName: dto.showZoneName ?? dto.show_zone_name ?? false,
  };
}

export function mapWaiterOrder(dto: WaiterOrderDto): WaiterOrder {
  return {
    ...dto,
    displayName: dto.displayName ?? dto.display_name ?? null,
    items: dto.items.map((item) => ({
      ...item,
      baseUnitPrice: item.baseUnitPrice ?? item.base_unit_price,
      unitPrice: item.unitPrice ?? item.unit_price,
      saleUnit: item.saleUnit ?? item.sale_unit ?? 'piece',
      modifiers: mapPosOrderItemModifiers(item.modifiers),
    })),
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
