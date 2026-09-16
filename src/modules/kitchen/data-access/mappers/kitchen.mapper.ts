import type { KitchenItem, KitchenMonitorQueue, KitchenMonitorTicket, KitchenTicket } from 'modules/kitchen/domain';
import type { SaleUnit } from 'shared/domain/sale-units';

type KitchenItemDto = KitchenItem & { sale_unit?: SaleUnit };
type KitchenTicketDto = Omit<KitchenTicket, 'items' | 'tableNumber'> & {
  tableNumber?: string | number | null;
  items: KitchenItemDto[];
  table_number?: string | number | null;
  zone_name?: string | null;
  show_zone_name?: boolean;
};
type KitchenMonitorTicketDto = KitchenMonitorTicket;
type KitchenMonitorQueueDto = Omit<KitchenMonitorQueue, 'monitorVariant'> & { monitorVariant?: string };

export function mapKitchenTicket(dto: KitchenTicketDto): KitchenTicket {
  return {
    ...dto,
    tableNumber:
      (dto.tableNumber ?? dto.table_number ?? null) === null ? null : String(dto.tableNumber ?? dto.table_number),
    zoneName: dto.zoneName ?? dto.zone_name ?? null,
    showZoneName: dto.showZoneName ?? dto.show_zone_name ?? false,
    items: dto.items.map((item) => ({
      ...item,
      saleUnit: item.saleUnit ?? item.sale_unit ?? 'piece',
    })),
  };
}

export function mapKitchenTickets(dtos: KitchenTicketDto[]) {
  return dtos.map(mapKitchenTicket);
}

export function mapKitchenMonitorTicket(dto: KitchenMonitorTicketDto): KitchenMonitorTicket {
  return { ...dto };
}

export function mapKitchenMonitorQueue(dto: KitchenMonitorQueueDto): KitchenMonitorQueue {
  return {
    monitorVariant: dto.monitorVariant === 'light_compact' ? 'light_compact' : 'default',
    preparing: dto.preparing.map(mapKitchenMonitorTicket),
    recentlyDone: dto.recentlyDone.map(mapKitchenMonitorTicket),
    announcements: (dto.announcements ?? []).map((announcement) => ({ ...announcement })),
  };
}
