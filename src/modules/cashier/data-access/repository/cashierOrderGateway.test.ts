import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CashierOrder } from 'modules/cashier/domain';

const { apiDeleteMock, apiPatchMock, apiPostMock } = vi.hoisted(() => ({
  apiDeleteMock: vi.fn(),
  apiPatchMock: vi.fn(),
  apiPostMock: vi.fn(),
}));

vi.mock('shared/api/client', () => ({
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  apiGet: vi.fn(),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  unwrapCollection: vi.fn(),
}));

import { cashierRepository } from './cashier.repository.impl';
import { cashierOrderGateway } from './cashierOrderGateway';

function orderResponse(orderNumber = 81) {
  return {
    id: 'order-1',
    order_number: orderNumber,
    status: 'open',
    subtotal: 25_000,
    serviceFee: 0,
    total: 25_000,
    note: '',
    channel: 'takeaway',
    items: [],
  } as unknown as CashierOrder;
}

describe('cashier order mutation transport contract', () => {
  beforeEach(() => {
    apiDeleteMock.mockReset();
    apiPatchMock.mockReset();
    apiPostMock.mockReset();
  });

  it('exposes the exact order gateway function references', () => {
    expect(cashierRepository.createBuilderOrder).toBe(cashierOrderGateway.createBuilderOrder);
    expect(cashierRepository.createTakeawayOrder).toBe(cashierOrderGateway.createTakeawayOrder);
    expect(cashierRepository.updateOrderChannel).toBe(cashierOrderGateway.updateOrderChannel);
    expect(cashierRepository.addOrderItem).toBe(cashierOrderGateway.addOrderItem);
    expect(cashierRepository.scanOrderMarking).toBe(cashierOrderGateway.scanOrderMarking);
    expect(cashierRepository.removeOrderItem).toBe(cashierOrderGateway.removeOrderItem);
    expect(cashierRepository.updateOrderNote).toBe(cashierOrderGateway.updateOrderNote);
    expect(cashierRepository.updateOrderDisplayName).toBe(cashierOrderGateway.updateOrderDisplayName);
    expect(cashierRepository.updateOrderDeliveryDetails).toBe(cashierOrderGateway.updateOrderDeliveryDetails);
    expect(cashierRepository.submitOrder).toBe(cashierOrderGateway.submitOrder);
  });

  it('creates a builder order with the current guest and delivery payload defaults', async () => {
    const response = { id: 'order-1' };
    apiPostMock.mockResolvedValueOnce(response);

    const result = await cashierRepository.createBuilderOrder({ channel: 'hall', note: 'near window' });

    expect(apiPostMock).toHaveBeenCalledWith('/pos/sales/orders/', {
      channel: 'hall',
      guestCount: 1,
      note: 'near window',
      deliveryPhone: undefined,
      deliveryAddress: undefined,
    });
    expect(result).not.toBe(response);
    expect(result).toEqual(response);
  });

  it('creates a takeaway order through the same builder payload contract', async () => {
    const response = { id: 'order-2' };
    apiPostMock.mockResolvedValueOnce(response);

    await expect(cashierRepository.createTakeawayOrder('no onions')).resolves.toEqual(response);
    expect(apiPostMock).toHaveBeenCalledWith('/pos/sales/orders/', {
      channel: 'takeaway',
      guestCount: 1,
      note: 'no onions',
      deliveryPhone: undefined,
      deliveryAddress: undefined,
    });
  });

  it('updates an order channel and maps the returned order', async () => {
    apiPatchMock.mockResolvedValueOnce(orderResponse());

    const result = await cashierRepository.updateOrderChannel('order-1', 'delivery');

    expect(apiPatchMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/', { channel: 'delivery' });
    expect(result.orderNumber).toBe(81);
  });

  it('adds one order item with the fixed quantity and returns the response by identity', async () => {
    const response = { kitchenPrintDocuments: ['document-1'] };
    apiPostMock.mockResolvedValueOnce(response);

    await expect(cashierRepository.addOrderItem('order-1', 'catalog-1', 'well done')).resolves.toBe(response);
    expect(apiPostMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/items/', {
      catalogItem: 'catalog-1',
      quantity: 1,
      note: 'well done',
    });
  });

  it('scans a marking with the raw code and mode then maps the nested order', async () => {
    apiPostMock.mockResolvedValueOnce({ order: orderResponse(82) });

    const result = await cashierRepository.scanOrderMarking('order-1', '0101234567890121', 'attach');

    expect(apiPostMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/scan-marking/', {
      rawCode: '0101234567890121',
      mode: 'attach',
    });
    expect(result.orderNumber).toBe(82);
  });

  it('deletes an order item through the item-scoped endpoint', async () => {
    apiDeleteMock.mockResolvedValueOnce({ ignored: true });

    await expect(cashierRepository.removeOrderItem('item-1')).resolves.toBeUndefined();
    expect(apiDeleteMock).toHaveBeenCalledWith('/pos/sales/orders/items/item-1/');
  });

  it('persists the order note before a printable document is created', async () => {
    apiPatchMock.mockResolvedValueOnce(orderResponse(83));

    const result = await cashierRepository.updateOrderNote('order-1', 'Piyozsiz');

    expect(apiPatchMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/', { note: 'Piyozsiz' });
    expect(result.orderNumber).toBe(83);
  });

  it('updates the display name and maps the returned order', async () => {
    apiPatchMock.mockResolvedValueOnce(orderResponse(83));

    const result = await cashierRepository.updateOrderDisplayName('order-1', 'Terrace 4');

    expect(apiPatchMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/', { displayName: 'Terrace 4' });
    expect(result.orderNumber).toBe(83);
  });

  it('updates delivery details with the exact payload and maps the returned order', async () => {
    apiPatchMock.mockResolvedValueOnce(orderResponse(84));
    const payload = { deliveryPhone: '+998901234567', deliveryAddress: 'Tashkent, Amir Temur 1' };

    const result = await cashierRepository.updateOrderDeliveryDetails('order-1', payload);

    expect(apiPatchMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/', payload);
    expect(result.orderNumber).toBe(84);
  });

  it('submits an order through the action endpoint and maps the returned order', async () => {
    apiPostMock.mockResolvedValueOnce(orderResponse(85));

    const result = await cashierRepository.submitOrder('order-1');

    expect(apiPostMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/submit/');
    expect(result.orderNumber).toBe(85);
  });
});
