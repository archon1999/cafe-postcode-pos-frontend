// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TableSessionPage } from './TableSessionPage';

const canAccessTableSessionEditorMock = vi.fn();
const getPosHomePathMock = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => <div>redirect:{to}</div>,
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock('modules/auth', () => ({
  canAccessTableSessionEditor: (...args: unknown[]) => canAccessTableSessionEditorMock(...args),
  canAccessTakeawayBuilder: () => true,
  getPosHomePath: (...args: unknown[]) => getPosHomePathMock(...args),
  usePosSession: () => ({
    session: { user: { id: 'cashier-1', permissionCodes: ['pos_open_checks.view'] } },
  }),
}));

vi.mock('./TableSessionPage/TableSessionPageContent', () => ({
  TableSessionPageContent: ({
    sessionId,
    mode,
    source,
  }: {
    sessionId: string | null;
    mode: string;
    source?: string | null;
  }) => <div>{`content:${mode}:${sessionId}:${source ?? 'none'}`}</div>,
}));

describe('TableSessionPage', () => {
  beforeEach(() => {
    canAccessTableSessionEditorMock.mockReset();
    getPosHomePathMock.mockReset();
    useSearchParamsMock.mockReset();
    getPosHomePathMock.mockReturnValue('/lock-screen');
  });

  it('allows cashier-origin session access from open-checks', () => {
    useSearchParamsMock.mockReturnValue([new URLSearchParams('sessionId=session-1&source=cashier')]);
    canAccessTableSessionEditorMock.mockReturnValue(true);

    render(<TableSessionPage />);

    expect(screen.getByText('content:hall:session-1:cashier')).toBeTruthy();
    expect(canAccessTableSessionEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cashier-1' }),
      'cashier',
    );
  });

  it('redirects when a cashier opens the session page without the cashier source marker', () => {
    useSearchParamsMock.mockReturnValue([new URLSearchParams('sessionId=session-1')]);
    canAccessTableSessionEditorMock.mockReturnValue(false);

    render(<TableSessionPage />);

    expect(screen.getByText('redirect:/lock-screen')).toBeTruthy();
  });
});
