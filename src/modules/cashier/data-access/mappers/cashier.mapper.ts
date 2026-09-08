import type {
  CashierCreateOrderResponse,
  CashierMenuCategory,
  CashierMenuItem,
  CashierOrder,
  CashierOrderItem,
  CashierPaymentResponse,
} from 'modules/cashier/domain';
import type { SaleUnit } from 'shared/domain/sale-units';
import { mapPosModifierGroups, mapPosOrderItemModifiers } from 'shared/pos/modifiers';
import { normalizeServiceFeeComponents } from 'shared/pos/service-fees';

type CashierMenuItemDto = CashierMenuItem & {
  image_url?: string | null;
  item_type?: 'product' | 'service';
  sale_unit?: SaleUnit;
  modifier_groups?: Parameters<typeof mapPosModifierGroups>[0];
};
type CashierMenuItemGroupDto = {
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
    item: CashierMenuItemDto;
  }>;
};
type CashierMenuCategoryDto = Omit<CashierMenuCategory, 'items' | 'itemGroups'> & {
  image_url?: string | null;
  items: CashierMenuItemDto[];
  itemGroups?: CashierMenuItemGroupDto[];
  item_groups?: CashierMenuItemGroupDto[];
};
type CashierMarkingDto = NonNullable<CashierOrderItem['markings']>[number] & {
  raw_code?: string;
  scanned_at?: string;
};
type CashierOrderItemDto = Omit<CashierOrderItem, 'markings'> & {
  markings?: CashierMarkingDto[];
  marking_required_count?: number;
  marking_scanned_count?: number;
  base_unit_price?: number | string;
  unit_price?: number | string;
  sale_unit?: SaleUnit;
  modifiers?: Parameters<typeof mapPosOrderItemModifiers>[0];
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
  calculated_total?: number | string;
  total_override?: number | string | null;
  total_override_reason?: string;
  total_overridden_at?: string | null;
  payment_total_editable?: boolean;
  table_number?: number | null;
  zone_name?: string | null;
  show_zone_name?: boolean;
  service_fee_components?: CashierOrder['serviceFeeComponents'];
  service_fee_started_at?: string | null;
  service_fee_frozen_at?: string | null;
  service_fee_billable_minutes?: number;
  service_fee_quote?: CashierOrder['serviceFeeQuote'];
};
type CashierFiscalReceiptDto = Omit<NonNullable<CashierPaymentResponse['receipt']>, 'payload'> & {
  payload?: {
    receiptNumber?: string;
    receipt_number?: string;
    issuedAt?: string;
    issued_at?: string;
    response?: Record<string, unknown>;
  };
};
type CashierPaymentResponseDto = Omit<CashierPaymentResponse, 'receipt' | 'receipts'> & {
  receipt: CashierFiscalReceiptDto | null;
  receipts?: Array<CashierFiscalReceiptDto | null>;
};
type CashierCreateOrderResponseDto = CashierCreateOrderResponse;

export function mapCashierMenuCategory(dto: CashierMenuCategoryDto): CashierMenuCategory {
  const mapItem = (item: CashierMenuItemDto): CashierMenuItem => ({
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
    itemGroups: (dto.itemGroups ?? dto.item_groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      sortOrder: Number(group.sortOrder ?? group.sort_order ?? 0),
      members: group.members.map((member) => ({
        id: member.id,
        variantName: member.variantName ?? member.variant_name ?? '',
        sortOrder: Number(member.sortOrder ?? member.sort_order ?? 0),
        item: mapItem(member.item),
      })),
    })),
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
    calculatedTotal: dto.calculatedTotal ?? dto.calculated_total ?? dto.total,
    totalOverride: dto.totalOverride ?? dto.total_override ?? null,
    totalOverrideReason: dto.totalOverrideReason ?? dto.total_override_reason ?? '',
    totalOverriddenAt: dto.totalOverriddenAt ?? dto.total_overridden_at ?? null,
    paymentTotalEditable: dto.paymentTotalEditable ?? dto.payment_total_editable ?? false,
    tableNumber: dto.tableNumber ?? dto.table_number ?? null,
    zoneName: dto.zoneName ?? dto.zone_name ?? null,
    showZoneName: dto.showZoneName ?? dto.show_zone_name ?? false,
    serviceFeeComponents: normalizeServiceFeeComponents(dto.serviceFeeComponents ?? dto.service_fee_components),
    serviceFeeStartedAt: dto.serviceFeeStartedAt ?? dto.service_fee_started_at ?? null,
    serviceFeeFrozenAt: dto.serviceFeeFrozenAt ?? dto.service_fee_frozen_at ?? null,
    serviceFeeBillableMinutes: dto.serviceFeeBillableMinutes ?? dto.service_fee_billable_minutes,
    serviceFeeQuote: dto.serviceFeeQuote ?? dto.service_fee_quote ?? null,
    items: dto.items.map((item) => ({
      ...item,
      markingRequiredCount: item.markingRequiredCount ?? item.marking_required_count,
      markingScannedCount: item.markingScannedCount ?? item.marking_scanned_count,
      baseUnitPrice: item.baseUnitPrice ?? item.base_unit_price,
      unitPrice: item.unitPrice ?? item.unit_price,
      saleUnit: item.saleUnit ?? item.sale_unit ?? 'piece',
      modifiers: mapPosOrderItemModifiers(item.modifiers),
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

export function mapCashierReceipt<T extends { payload?: object | null }>(receipt: T): T {
  if (!receipt.payload) return receipt;
  const payload = receipt.payload as Record<string, unknown>;
  const response = payload.response as Record<string, unknown> | undefined;
  const number =
    response?.ReceiptSeq ??
    response?.receiptSeq ??
    response?.receipt_seq ??
    payload.receiptNumber ??
    payload.receipt_number;
  const issuedAt =
    payload.issuedAt ?? payload.issued_at ?? response?.DateTime ?? response?.dateTime ?? response?.date_time;
  return {
    ...receipt,
    ...(typeof payload.detail === 'string' ? { fiscalErrorMessage: payload.detail } : {}),
    payload: {
      ...payload,
      ...(number === undefined || number === null || number === '' ? {} : { receiptNumber: String(number) }),
      ...(typeof issuedAt === 'string' ? { issuedAt } : {}),
    },
  };
}

export function mapCashierPaymentResponse(dto: CashierPaymentResponseDto): CashierPaymentResponse {
  return {
    ...dto,
    order: mapCashierOrder(dto.order),
    receipt: dto.receipt ? mapCashierReceipt(dto.receipt) : dto.receipt,
    ...(dto.receipts
      ? { receipts: dto.receipts.map((receipt) => (receipt ? mapCashierReceipt(receipt) : receipt)) }
      : {}),
  };
}

export function mapCashierCreateOrderResponse(dto: CashierCreateOrderResponseDto): CashierCreateOrderResponse {
  return { ...dto };
}
