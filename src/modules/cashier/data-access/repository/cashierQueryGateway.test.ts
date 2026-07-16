import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CashierOrder } from 'modules/cashier/domain';

const { apiGetMock } = vi.hoisted(() => ({ apiGetMock: vi.fn() }));

vi.mock('shared/api/client', async () => {
  const actual = await vi.importActual<typeof import('shared/api/client')>('shared/api/client');
  return { ...actual, apiGet: (...args: unknown[]) => apiGetMock(...args) };
});

import { cashierRepository } from './cashier.repository.impl';
import { cashierQueryGateway } from './cashierQueryGateway';

function orderResponse(orderNumber = 91) {
  return {
    id: `order-${orderNumber}`,
    order_number: orderNumber,
    status: 'open',
    subtotal: 30_000,
    serviceFee: 0,
    total: 30_000,
    note: '',
    channel: 'takeaway',
    items: [],
  } as unknown as CashierOrder;
}

describe('cashier query transport contract', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('exposes the exact query gateway function references', () => {
    expect(cashierRepository.getCashierContext).toBe(cashierQueryGateway.getCashierContext);
    expect(cashierRepository.getMenu).toBe(cashierQueryGateway.getMenu);
    expect(cashierRepository.getOpenOrders).toBe(cashierQueryGateway.getOpenOrders);
    expect(cashierRepository.getOpenChecks).toBe(cashierQueryGateway.getOpenChecks);
    expect(cashierRepository.getOrder).toBe(cashierQueryGateway.getOrder);
  });

  it('returns the cashier context response by identity', async () => {
    const response = { restaurant: { id: 'restaurant-1' }, shift: { id: 'shift-1' } };
    apiGetMock.mockResolvedValueOnce(response);

    await expect(cashierRepository.getCashierContext()).resolves.toBe(response);
    expect(apiGetMock).toHaveBeenCalledWith('/pos/billing/context/');
  });

  it('unwraps and maps a wrapped menu collection', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: [
        {
          id: 'category-1',
          name: 'Drinks',
          image_url: 'category.png',
          items: [{ id: 'item-1', name: 'Tea', image_url: 'tea.png' }],
        },
      ],
    });

    const result = await cashierRepository.getMenu();

    expect(apiGetMock).toHaveBeenCalledWith('/pos/catalog/menu/');
    expect(result[0]).toMatchObject({ imageUrl: 'category.png' });
    expect(result[0]?.items[0]).toMatchObject({ imageUrl: 'tea.png' });
  });

  it('unwraps and maps the open-order collection', async () => {
    apiGetMock.mockResolvedValueOnce([orderResponse()]);

    const result = await cashierRepository.getOpenOrders();

    expect(apiGetMock).toHaveBeenCalledWith('/pos/sales/orders/?status=open');
    expect(result).toHaveLength(1);
    expect(result[0]?.orderNumber).toBe(91);
  });

  it('maps an order detail response from its item-scoped path', async () => {
    apiGetMock.mockResolvedValueOnce(orderResponse(92));

    const result = await cashierRepository.getOrder('order-92');

    expect(apiGetMock).toHaveBeenCalledWith('/pos/sales/orders/order-92/');
    expect(result.orderNumber).toBe(92);
  });

  it('uses the open status by default and derives pagination for an array response', async () => {
    apiGetMock.mockResolvedValueOnce([orderResponse(93)]);

    const result = await cashierRepository.getOpenChecks();

    expect(apiGetMock).toHaveBeenCalledWith('/pos/billing/open-checks/?status=open');
    expect(result.orders[0]?.orderNumber).toBe(93);
    expect(result).toMatchObject({ count: 1, page: 1, pageSize: 1, numPages: 1 });
  });

  it('encodes every open-check filter and normalizes paginated metadata to numbers', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: [orderResponse(94)],
      count: '41',
      page: '2',
      pageSize: '25',
      numPages: '2',
    });

    const result = await cashierRepository.getOpenChecks('closed', { search: 'A&B', page: 2, pageSize: 25 });

    expect(apiGetMock).toHaveBeenCalledWith('/pos/billing/open-checks/?status=closed&search=A%26B&page=2&pageSize=25');
    expect(result.orders[0]?.orderNumber).toBe(94);
    expect(result).toMatchObject({ count: 41, page: 2, pageSize: 25, numPages: 2 });
  });
});
