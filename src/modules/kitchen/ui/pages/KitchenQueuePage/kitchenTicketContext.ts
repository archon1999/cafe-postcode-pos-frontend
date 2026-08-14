import type { KitchenTicket } from 'modules/kitchen/domain';
import { getPosOrderLocationLabel } from 'shared/pos/orderLocation';

type KitchenTicketContextCopy = {
  deliverySwitch: string;
  hallLabel: string;
  takeawaySwitch: string;
};

export function getKitchenTicketContextLabel(ticket: KitchenTicket, copy: KitchenTicketContextCopy) {
  const hallLocation = getPosOrderLocationLabel(ticket, { includeTable: true, separator: ', ' });

  if (ticket.channel === 'hall') {
    return hallLocation || copy.hallLabel;
  }
  if (ticket.channel === 'delivery') {
    return copy.deliverySwitch;
  }
  if (ticket.channel === 'online') {
    return 'Online';
  }
  return copy.takeawaySwitch;
}

export function getKitchenTicketDisplayNumber(ticket: KitchenTicket) {
  return ticket.displayName?.trim() || String(ticket.orderNumber);
}
