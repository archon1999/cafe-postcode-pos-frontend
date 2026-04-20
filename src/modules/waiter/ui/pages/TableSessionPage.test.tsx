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
  TableSessionPageContent: ({ sessionId, mode }: { sessionId: string | null; mode: string }) => (
    <div>{`content:${mode}:${sessionId}`}</div>
  ),
}));

describe('TableSessionPage', () => {
  beforeEach(() => {
    canAccessTableSessionEditorMock.mockReset();
    getPosHomePathMock.mockReset();
    useSearchParamsMock.mockReset();
    getPosHomePathMock.mockReturnValue('/lock-screen');
  });

  it('renders the hall session when access is allowed', () => {
    useSearchParamsMock.mockReturnValue([new URLSearchParams('sessionId=session-1')]);
    canAccessTableSessionEditorMock.mockReturnValue(true);

    render(<TableSessionPage />);

    expect(screen.getByText('content:hall:session-1')).toBeTruthy();
    expect(canAccessTableSessionEditorMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'cashier-1' }));
  });

  it('redirects when access is denied', () => {
    useSearchParamsMock.mockReturnValue([new URLSearchParams('sessionId=session-1')]);
    canAccessTableSessionEditorMock.mockReturnValue(false);

    render(<TableSessionPage />);

    expect(screen.getByText('redirect:/lock-screen')).toBeTruthy();
  });
});
