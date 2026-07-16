import type { KitchenTicket } from 'modules/kitchen/domain';

type KitchenTicketContextCopy = {
  deliverySwitch: string;
  hallLabel: string;
  takeawaySwitch: string;
};

export function getKitchenTicketContextLabel(ticket: KitchenTicket, copy: KitchenTicketContextCopy) {
  const hallLocation = [ticket.hallName, ticket.tableName].filter(Boolean).join(', ');

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
