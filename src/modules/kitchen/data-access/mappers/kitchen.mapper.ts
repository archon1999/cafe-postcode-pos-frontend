import type { KitchenItem, KitchenTicket } from 'modules/kitchen/domain';

type KitchenItemDto = KitchenItem;
type KitchenTicketDto = Omit<KitchenTicket, 'items'> & { items: KitchenItemDto[] };

export function mapKitchenTicket(dto: KitchenTicketDto): KitchenTicket {
  return {
    ...dto,
    items: dto.items.map((item) => ({ ...item })),
  };
}

export function mapKitchenTickets(dtos: KitchenTicketDto[]) {
  return dtos.map(mapKitchenTicket);
}
