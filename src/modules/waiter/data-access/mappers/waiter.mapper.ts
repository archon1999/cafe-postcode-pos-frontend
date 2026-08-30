import type {
  ActiveSession,
  DiningTable,
  Hall,
  TableSession,
  WaiterCreateOrderResponse,
  WaiterMenuCategory,
  WaiterMenuItem,
  WaiterMenuItemGroup,
  WaiterOrder,
  WaiterOrderItem,
  WaiterSessionResponse,
} from 'modules/waiter/domain';
import { mapPosModifierGroups, mapPosOrderItemModifiers } from 'shared/pos/modifiers';
import { normalizeServiceFeeComponents } from 'shared/pos/service-fees';

type WaiterMenuItemDto = WaiterMenuItem & {
  image_url?: string | null;
  item_type?: 'product' | 'service';
  sale_unit?: 'piece' | 'kg';
  modifier_groups?: Parameters<typeof mapPosModifierGroups>[0];
};
type WaiterMenuItemGroupDto = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  sort_order?: number;
  members: Array<{
    id: string;
    variantName?: string;
    variant_name?: string;
    sortOrder?: number;
    sort_order?: number;
    item: WaiterMenuItemDto;
  }>;
};
type WaiterMenuCategoryDto = Omit<WaiterMenuCategory, 'items' | 'itemGroups'> & {
  image_url?: string | null;
  items: WaiterMenuItemDto[];
  itemGroups?: WaiterMenuItemGroupDto[];
  item_groups?: WaiterMenuItemGroupDto[];
};
type ActiveSessionDto = ActiveSession & {
  guest_count?: number;
  created_at?: string;
  service_state?: string;
  primary_table_id?: string;
  table_ids?: string[];
  table_numbers?: number[];
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
  service_fee_percent?: number | string;
  service_fee_components?: TableSession['serviceFeeComponents'];
  opened_at?: string | null;
  group_table_count?: number;
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
  service_fee_components?: WaiterOrder['serviceFeeComponents'];
  service_fee_started_at?: string | null;
  service_fee_frozen_at?: string | null;
  service_fee_billable_minutes?: number;
  service_fee_quote?: WaiterOrder['serviceFeeQuote'];
};
type WaiterSessionResponseDto = WaiterSessionResponse;
type WaiterCreateOrderResponseDto = WaiterCreateOrderResponse;

export function mapWaiterMenuCategory(dto: WaiterMenuCategoryDto): WaiterMenuCategory {
  const mapItem = (item: WaiterMenuItemDto): WaiterMenuItem => ({
    ...item,
    imageUrl: item.imageUrl ?? item.image_url ?? null,
    itemType: item.itemType ?? item.item_type ?? 'product',
    saleUnit: item.saleUnit ?? item.sale_unit ?? 'piece',
    modifierGroups: mapPosModifierGroups(item.modifierGroups ?? item.modifier_groups),
  });

  return {
    ...dto,
    imageUrl: dto.imageUrl ?? dto.image_url ?? null,
    items: dto.items.map(mapItem),
    itemGroups: (dto.itemGroups ?? dto.item_groups ?? []).map(
      (group): WaiterMenuItemGroup => ({
        id: group.id,
        name: group.name,
        description: group.description ?? null,
        sortOrder: Number(group.sortOrder ?? group.sort_order ?? 0),
        members: group.members.map((member) => ({
          id: member.id,
          variantName: member.variantName ?? member.variant_name ?? '',
          sortOrder: Number(member.sortOrder ?? member.sort_order ?? 0),
          item: mapItem(member.item),
        })),
      }),
    ),
  };
}

export function mapWaiterMenuCategories(dtos: WaiterMenuCategoryDto[]) {
  return dtos.map(mapWaiterMenuCategory);
}

function mapActiveSession(dto: ActiveSessionDto): ActiveSession {
  const tableIds = dto.tableIds ?? dto.table_ids ?? [];
  return {
    ...dto,
    guestCount: dto.guestCount ?? dto.guest_count ?? 0,
    createdAt: dto.createdAt ?? dto.created_at,
    serviceState: dto.serviceState ?? dto.service_state,
    primaryTableId: dto.primaryTableId ?? dto.primary_table_id ?? tableIds[0],
    tableIds,
    tableNumbers: dto.tableNumbers ?? dto.table_numbers ?? [],
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
    serviceFeePercent: dto.serviceFeePercent ?? dto.service_fee_percent ?? 0,
    openedAt: dto.openedAt ?? dto.opened_at ?? null,
    serviceFeeComponents: normalizeServiceFeeComponents(dto.serviceFeeComponents ?? dto.service_fee_components),
    groupTableCount: dto.groupTableCount ?? dto.group_table_count ?? dto.tables?.length ?? 1,
  };
}

export function mapWaiterOrder(dto: WaiterOrderDto): WaiterOrder {
  return {
    ...dto,
    displayName: dto.displayName ?? dto.display_name ?? null,
    serviceFeeComponents: normalizeServiceFeeComponents(dto.serviceFeeComponents ?? dto.service_fee_components),
    serviceFeeStartedAt: dto.serviceFeeStartedAt ?? dto.service_fee_started_at ?? null,
    serviceFeeFrozenAt: dto.serviceFeeFrozenAt ?? dto.service_fee_frozen_at ?? null,
    serviceFeeBillableMinutes: dto.serviceFeeBillableMinutes ?? dto.service_fee_billable_minutes,
    serviceFeeQuote: dto.serviceFeeQuote ?? dto.service_fee_quote ?? null,
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
