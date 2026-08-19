// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPageContent } from './LoginPageContent';

const navigateMock = vi.fn();
const setLocaleMock = vi.fn();
const setSessionMock = vi.fn();
const setThemeModeMock = vi.fn();
const unlockSessionMock = vi.fn();
const mutateMock = vi.fn();
const usePinLoginMutationMock = vi.fn();
let authState = 'PAIRED_NO_USER';

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useLocation: () => ({ search: '?next=%2Fmonitor%2Fqueue' }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('../session-context', () => ({
  usePosSession: () => ({
    authState,
    locale: 'uz',
    restaurantContext: {
      restaurantId: 'restaurant-1',
      restaurantName: 'Test restaurant',
    },
    setLocale: setLocaleMock,
    setSession: setSessionMock,
    themeMode: 'dark',
    setThemeMode: setThemeModeMock,
    unlockSession: unlockSessionMock,
  }),
}));

vi.mock('../../application', () => ({
  usePinLoginMutation: (...args: unknown[]) => usePinLoginMutationMock(...args),
}));

vi.mock('shared/ui/PosLogo', () => ({
  PosLogo: () => <div aria-hidden="true" />,
}));

describe('LoginPageContent', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mutateMock.mockReset();
    setLocaleMock.mockReset();
    setSessionMock.mockReset();
    setThemeModeMock.mockReset();
    unlockSessionMock.mockReset();
    authState = 'PAIRED_NO_USER';
    usePinLoginMutationMock.mockReset();
    usePinLoginMutationMock.mockReturnValue({
      isPending: false,
      mutate: mutateMock,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses the locked-session unlock endpoint and rotates to its returned session', async () => {
    authState = 'LOCKED';
    unlockSessionMock.mockResolvedValue({
      token: 'rotated-token',
      user: { id: 'user-1', username: 'manager', fullName: 'Manager', permissionCodes: [] },
    });
    render(<LoginPageContent />);

    for (const digit of ['1', '2', '3', '4']) fireEvent.click(screen.getByRole('button', { name: digit }));

    await waitFor(() => expect(unlockSessionMock).toHaveBeenCalledWith('1234'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/monitor/queue', { replace: true }));
    expect(mutateMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/monitor/queue', { replace: true });
  });

  it('returns to the requested page after PIN login', async () => {
    render(<LoginPageContent />);
    const options = usePinLoginMutationMock.mock.calls[0][0] as {
      onSuccess: (response: unknown) => void;
    };
    const response = {
      token: 'employee-token',
      user: { id: 'user-1', username: 'manager', fullName: 'Manager', permissionCodes: [] },
    };

    await act(async () => options.onSuccess(response));

    expect(setSessionMock).toHaveBeenCalledWith(response);
    expect(navigateMock).toHaveBeenCalledWith('/monitor/queue', { replace: true });
  });
});
