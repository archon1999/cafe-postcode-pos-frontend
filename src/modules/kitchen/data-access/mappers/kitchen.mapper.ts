import type { KitchenItem, KitchenMonitorQueue, KitchenMonitorTicket, KitchenTicket } from 'modules/kitchen/domain';

type KitchenItemDto = KitchenItem;
type KitchenTicketDto = Omit<KitchenTicket, 'items'> & {
  items: KitchenItemDto[];
  dispatch_number?: number;
  is_addition?: boolean;
  handed_off_at?: string | null;
};
type KitchenMonitorTicketDto = KitchenMonitorTicket;
type KitchenMonitorQueueDto = Omit<KitchenMonitorQueue, 'monitorVariant'> & { monitorVariant?: string };

export function mapKitchenTicket(dto: KitchenTicketDto): KitchenTicket {
  return {
    ...dto,
    dispatchNumber: dto.dispatchNumber ?? dto.dispatch_number ?? 1,
    isAddition: dto.isAddition ?? dto.is_addition ?? false,
    handedOffAt: dto.handedOffAt ?? dto.handed_off_at ?? null,
    items: dto.items.map((item) => ({ ...item })),
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
