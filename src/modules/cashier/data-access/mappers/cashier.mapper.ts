import type {
  CashierCreateOrderResponse,
  CashierMenuCategory,
  CashierMenuItem,
  CashierOrder,
  CashierOrderItem,
  CashierPaymentResponse,
} from 'modules/cashier/domain';

type CashierMenuItemDto = CashierMenuItem & { image_url?: string | null };
type CashierMenuCategoryDto = Omit<CashierMenuCategory, 'items'> & {
  image_url?: string | null;
  items: CashierMenuItemDto[];
};
type CashierMarkingDto = NonNullable<CashierOrderItem['markings']>[number] & {
  raw_code?: string;
  scanned_at?: string;
};
type CashierOrderItemDto = Omit<CashierOrderItem, 'markings'> & {
  markings?: CashierMarkingDto[];
  marking_required_count?: number;
  marking_scanned_count?: number;
};
type CashierOrderDto = Omit<CashierOrder, 'items' | 'orderNumber' | 'displayName'> & {
  items: CashierOrderItemDto[];
  orderNumber?: number;
  order_number?: number;
  displayName?: string | null;
  display_name?: string | null;
  deliveryPhone?: string | null;
  delivery_phone?: string | null;
  deliveryAddress?: string | null;
  delivery_address?: string | null;
};
type CashierPaymentResponseDto = CashierPaymentResponse;
type CashierCreateOrderResponseDto = CashierCreateOrderResponse;

export function mapCashierMenuCategory(dto: CashierMenuCategoryDto): CashierMenuCategory {
  return {
    ...dto,
    imageUrl: dto.imageUrl ?? dto.image_url ?? null,
    items: dto.items.map((item) => ({ ...item, imageUrl: item.imageUrl ?? item.image_url ?? null })),
  };
}

export function mapCashierMenuCategories(dtos: CashierMenuCategoryDto[]) {
  return dtos.map(mapCashierMenuCategory);
}

export function mapCashierOrder(dto: CashierOrderDto): CashierOrder {
  return {
    ...dto,
    orderNumber: dto.orderNumber ?? dto.order_number ?? 0,
    displayName: dto.displayName ?? dto.display_name ?? null,
    deliveryPhone: dto.deliveryPhone ?? dto.delivery_phone ?? null,
    deliveryAddress: dto.deliveryAddress ?? dto.delivery_address ?? null,
    items: dto.items.map((item) => ({
      ...item,
      markingRequiredCount: item.markingRequiredCount ?? item.marking_required_count,
      markingScannedCount: item.markingScannedCount ?? item.marking_scanned_count,
      markings: item.markings?.map((marking) => ({
        ...marking,
        rawCode: marking.rawCode ?? marking.raw_code,
        scannedAt: marking.scannedAt ?? marking.scanned_at,
      })),
    })),
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
