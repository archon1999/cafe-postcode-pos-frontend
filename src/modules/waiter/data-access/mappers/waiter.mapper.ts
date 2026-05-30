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
type ActiveSessionDto = ActiveSession;
type DiningTableDto = Omit<DiningTable, 'activeSession'> & { activeSession?: ActiveSessionDto | null };
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

export function mapHall(dto: HallDto): Hall {
  return {
    ...dto,
    tables: dto.tables.map((table) => ({
      ...table,
      activeSession: table.activeSession ? { ...table.activeSession } : null,
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
