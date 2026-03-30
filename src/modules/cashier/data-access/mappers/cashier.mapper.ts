import type {
  CashierCreateOrderResponse,
  CashierMenuCategory,
  CashierMenuItem,
  CashierOrder,
  CashierOrderItem,
  CashierPaymentResponse,
} from 'modules/cashier/domain';

type CashierMenuItemDto = CashierMenuItem;
type CashierMenuCategoryDto = Omit<CashierMenuCategory, 'items'> & { items: CashierMenuItemDto[] };
type CashierOrderItemDto = CashierOrderItem;
type CashierOrderDto = Omit<CashierOrder, 'items'> & { items: CashierOrderItemDto[] };
type CashierPaymentResponseDto = CashierPaymentResponse;
type CashierCreateOrderResponseDto = CashierCreateOrderResponse;

export function mapCashierMenuCategory(dto: CashierMenuCategoryDto): CashierMenuCategory {
  return {
    ...dto,
    items: dto.items.map((item) => ({ ...item })),
  };
}

export function mapCashierMenuCategories(dtos: CashierMenuCategoryDto[]) {
  return dtos.map(mapCashierMenuCategory);
}

export function mapCashierOrder(dto: CashierOrderDto): CashierOrder {
  return {
    ...dto,
    items: dto.items.map((item) => ({ ...item })),
  };
}

export function mapCashierOrders(dtos: CashierOrderDto[]) {
  return dtos.map(mapCashierOrder);
}

export function mapCashierPaymentResponse(dto: CashierPaymentResponseDto): CashierPaymentResponse {
  return {
    ...dto,
    order: mapCashierOrder(dto.order),
  };
}

export function mapCashierCreateOrderResponse(dto: CashierCreateOrderResponseDto): CashierCreateOrderResponse {
  return { ...dto };
}
