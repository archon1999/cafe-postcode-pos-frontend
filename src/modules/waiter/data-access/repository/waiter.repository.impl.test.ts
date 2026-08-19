import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiDeleteMock, apiPostMock } = vi.hoisted(() => ({
  apiDeleteMock: vi.fn(),
  apiPostMock: vi.fn(),
}));

vi.mock('shared/api/client', () => ({
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  unwrapCollection: vi.fn(),
}));

import { waiterRepository } from './waiter.repository.impl';

describe('waiter order item delete transport contract', () => {
  beforeEach(() => {
    apiDeleteMock.mockReset();
    apiPostMock.mockReset();
  });

  it('preserves kitchen cancellation documents from the delete response', async () => {
    const response = { kitchenPrintDocuments: ['cancel-document-1'] };
    apiDeleteMock.mockResolvedValueOnce(response);

    await expect(waiterRepository.removeOrderItem('item-1')).resolves.toEqual(response);
    expect(apiDeleteMock).toHaveBeenCalledWith('/pos/sales/orders/items/item-1/');
  });

  it('preserves the order removal signal from the delete response', async () => {
    apiDeleteMock.mockResolvedValueOnce({ orderRemoved: true });

    await expect(waiterRepository.removeOrderItem('last-item')).resolves.toEqual({
      kitchenPrintDocuments: [],
      orderRemoved: true,
    });
  });

  it('normalizes a legacy empty delete response to no kitchen documents', async () => {
    apiDeleteMock.mockResolvedValueOnce(undefined);

    await expect(waiterRepository.removeOrderItem('draft-item')).resolves.toEqual({
      kitchenPrintDocuments: [],
    });
  });

  it('sends a manually entered price for a service item', async () => {
    apiPostMock.mockResolvedValueOnce({});

    await waiterRepository.addOrderItem('order-1', 'service-1', '', [], 65000);

    expect(apiPostMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/items/', {
      catalogItem: 'service-1',
      quantity: 1,
      note: '',
      manualPrice: 65000,
    });
  });
});
