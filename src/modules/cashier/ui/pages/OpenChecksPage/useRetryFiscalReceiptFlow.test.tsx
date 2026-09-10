// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPosCopy } from 'shared/locale/copy';

import { useRetryFiscalReceiptFlow } from './useRetryFiscalReceiptFlow';

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), response: {} as Record<string, unknown> }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('modules/cashier/application', () => ({
  useCashierFiscalRetryMutation: (options: { onSuccess: (response: unknown) => void }) => ({
    isPending: false,
    mutate: () => options.onSuccess(mocks.response),
  }),
}));

describe('fiscal retry result visibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    {},
    { receipts: [] },
    { receipts: [{ id: 'r1', status: 'unknown' }] },
    { receipts: [{ id: 'r1', status: 'registering' }] },
    { receipts: [{ id: 'r1', fiscalState: 'unknown', printDocument: 'doc1' }] },
  ])('does not show fiscal success or a print dialog for an unconfirmed result %j', (response) => {
    mocks.response = response;
    const { result } = renderHook(() =>
      useRetryFiscalReceiptFlow({ copy: getPosCopy('uz'), onFinished: vi.fn(), printDocuments: vi.fn() }),
    );
    act(() => result.current.retry('payment1'));
    expect(result.current.dialog).toBeNull();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(getPosCopy('uz').fiscalReceiptUnknown);
  });

  it('automatically prints the durable document after a confirmed receipt', () => {
    mocks.response = { receipts: [{ id: 'r1', status: 'sent', printDocument: 'doc1' }] };
    const printDocuments = vi.fn();
    const { result } = renderHook(() =>
      useRetryFiscalReceiptFlow({ copy: getPosCopy('uz'), onFinished: vi.fn(), printDocuments }),
    );
    act(() => result.current.retry('payment1'));
    expect(result.current.dialog).toBeNull();
    expect(printDocuments).toHaveBeenCalledTimes(1);
    expect(printDocuments).toHaveBeenCalledWith(['doc1']);
  });
});
