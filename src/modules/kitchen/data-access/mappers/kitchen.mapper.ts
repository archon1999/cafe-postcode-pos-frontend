import type { KitchenItem, KitchenMonitorQueue, KitchenMonitorTicket, KitchenTicket } from 'modules/kitchen/domain';

type KitchenItemDto = KitchenItem;
type KitchenTicketDto = Omit<KitchenTicket, 'items'> & { items: KitchenItemDto[] };
type KitchenMonitorTicketDto = KitchenMonitorTicket;
type KitchenMonitorQueueDto = KitchenMonitorQueue;

export function mapKitchenTicket(dto: KitchenTicketDto): KitchenTicket {
  return {
    ...dto,
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
    preparing: dto.preparing.map(mapKitchenMonitorTicket),
    recentlyDone: dto.recentlyDone.map(mapKitchenMonitorTicket),
  };
}
