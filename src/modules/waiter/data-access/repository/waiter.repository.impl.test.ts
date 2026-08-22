import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { waiterRepository } from './waiter.repository.impl';

describe('waiter order item delete transport contract', () => {
  beforeEach(() => {
    apiDeleteMock.mockReset();
    apiPatchMock.mockReset();
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

  it('updates only the selected order item note through the item endpoint', async () => {
    apiPatchMock.mockResolvedValueOnce({});

    await waiterRepository.updateOrderItemNote('item-1', 'Kamroq tuz');

    expect(apiPatchMock).toHaveBeenCalledWith('/pos/sales/orders/items/item-1/', { note: 'Kamroq tuz' });
  });

  it('keeps a separate note in a weighted-item bulk payload', async () => {
    apiPostMock.mockResolvedValueOnce({});

    await waiterRepository.addOrderItems('order-1', [
      { catalogItemId: 'fish-1', quantity: 1.4, note: 'Tozalab bering' },
    ]);

    expect(apiPostMock).toHaveBeenCalledWith('/pos/sales/orders/order-1/items/bulk/', {
      items: [{ catalogItem: 'fish-1', quantity: 1.4, note: 'Tozalab bering' }],
    });
  });
});
