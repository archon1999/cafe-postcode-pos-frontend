// @vitest-environment jsdom

import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CashierContext, CashShiftSummary } from '../domain';

import { useCashierContextQuery } from './queries';

const getContext = vi.hoisted(() => vi.fn());
vi.mock('../data-access', () => ({ cashierRepository: { getCashierContext: getContext } }));

const closedContext = { currentShift: null, activeShifts: [], pendingClosedShifts: [] } as unknown as CashierContext;
const pendingShift = { id: 'shift-1', status: 'closed-local', syncState: 'pending' } as CashShiftSummary;
const pendingContext = { ...closedContext, pendingClosedShifts: [pendingShift] };

describe('cashier shift close refresh', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    getContext.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  });
  afterEach(() => {
    cleanup();
    client.clear();
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });
  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };
  const mount = (enabled = true, refetchInterval: number | false = 60_000) =>
    renderHook(() => useCashierContextQuery({ enabled, refetchInterval, refreshClosingShifts: true }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

  it('refreshes a pending close until acknowledgement, then resumes normal polling', async () => {
    getContext
      .mockResolvedValueOnce(pendingContext)
      .mockResolvedValueOnce(pendingContext)
      .mockResolvedValueOnce(pendingContext)
      .mockResolvedValue(closedContext);
    const { result } = mount();
    await advance(1);
    expect(result.current.data?.pendingClosedShifts).toHaveLength(1);
    await advance(6_001);
    expect(getContext).toHaveBeenCalledTimes(4);
    expect(result.current.data?.pendingClosedShifts).toEqual([]);
    await advance(20_000);
    expect(getContext).toHaveBeenCalledTimes(4);
    await advance(40_000);
    expect(getContext).toHaveBeenCalledTimes(5);
  });

  it('retains a pending close during connection failure and refreshes after recovery', async () => {
    getContext
      .mockResolvedValueOnce(pendingContext)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(closedContext);
    const { result } = mount();
    await advance(2_002);
    expect(result.current.data?.pendingClosedShifts).toHaveLength(1);
    expect(result.current.isError).toBe(true);
    await advance(2_001);
    expect(result.current.data?.pendingClosedShifts).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it.each(['closing', 'closed_local'] as const)('refreshes %s shifts returned in the active list', async (status) => {
    getContext.mockResolvedValue({ ...closedContext, activeShifts: [{ ...pendingShift, status }] });
    mount();
    await advance(4_001);
    expect(getContext).toHaveBeenCalledTimes(3);
  });

  it('keeps an unknown fiscal result visible while checking current state', async () => {
    const unknown = { ...pendingShift, status: 'closing', closeState: 'fiscal_unknown', syncState: 'action_required' };
    getContext.mockResolvedValue({ ...closedContext, currentShift: unknown });
    const { result } = mount();
    await advance(4_001);
    expect(getContext).toHaveBeenCalledTimes(3);
    expect(result.current.data?.currentShift?.closeState).toBe('fiscal_unknown');
  });

  it('does not poll settled shifts at the fast interval', async () => {
    getContext.mockResolvedValue(closedContext);
    mount();
    await advance(20_001);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it('respects explicitly disabled polling', async () => {
    getContext.mockResolvedValue(pendingContext);
    mount(true, false);
    await advance(10_001);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it('does not fetch without access or after leaving the page', async () => {
    getContext.mockResolvedValue(pendingContext);
    const disabled = mount(false);
    await advance(4_001);
    expect(getContext).not.toHaveBeenCalled();
    disabled.unmount();
    const enabled = mount();
    await advance(1);
    enabled.unmount();
    await advance(10_000);
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});
