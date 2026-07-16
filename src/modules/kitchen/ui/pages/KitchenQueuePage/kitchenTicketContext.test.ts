import { describe, expect, it } from 'vitest';

import type { KitchenTicket } from 'modules/kitchen/domain';

import { getKitchenTicketContextLabel, getKitchenTicketDisplayNumber } from './kitchenTicketContext';

const copy = {
  deliverySwitch: 'Dostavka',
  hallLabel: 'Zal',
  takeawaySwitch: 'Soboy',
};

function ticket(overrides: Partial<KitchenTicket>): KitchenTicket {
  return {
    id: 'ticket-1',
    orderNumber: 1,
    channel: 'takeaway',
    prepStationName: 'Oshxona',
    status: 'new',
    hallName: null,
    tableName: null,
    items: [],
    ...overrides,
  };
}

describe('getKitchenTicketContextLabel', () => {
  it.each([
    ['takeaway', 'Soboy'],
    ['delivery', 'Dostavka'],
    ['online', 'Online'],
  ] as const)('renders the %s channel once', (channel, expected) => {
    expect(getKitchenTicketContextLabel(ticket({ channel }), copy)).toBe(expected);
  });

  it('renders the hall and table names without fallback duplication', () => {
    expect(
      getKitchenTicketContextLabel(ticket({ channel: 'hall', hallName: 'Asosiy zal', tableName: 'Stol 4' }), copy),
    ).toBe('Asosiy zal, Stol 4');
    expect(getKitchenTicketContextLabel(ticket({ channel: 'hall' }), copy)).toBe('Zal');
  });

  it('uses the same display number as the receipt and falls back for old tickets', () => {
    expect(getKitchenTicketDisplayNumber(ticket({ displayName: '27', orderNumber: 1831 }))).toBe('27');
    expect(getKitchenTicketDisplayNumber(ticket({ displayName: '', orderNumber: 1831 }))).toBe('1831');
  });
});
