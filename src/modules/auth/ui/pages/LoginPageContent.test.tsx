// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPageContent } from './LoginPageContent';

const navigateMock = vi.fn();
const setLocaleMock = vi.fn();
const setRestaurantContextMock = vi.fn();
const setSessionMock = vi.fn();
const setThemeModeMock = vi.fn();
const mutateMock = vi.fn();
const usePinLoginMutationMock = vi.fn();

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
    locale: 'uz',
    restaurantContext: {
      restaurantId: 'restaurant-1',
      restaurantName: 'Test restaurant',
    },
    setLocale: setLocaleMock,
    setRestaurantContext: setRestaurantContextMock,
    setSession: setSessionMock,
    themeMode: 'dark',
    setThemeMode: setThemeModeMock,
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
    setRestaurantContextMock.mockReset();
    setSessionMock.mockReset();
    setThemeModeMock.mockReset();
    usePinLoginMutationMock.mockReset();
    usePinLoginMutationMock.mockReturnValue({
      isPending: false,
      mutate: mutateMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns to restaurant auth when the sign out button is clicked', () => {
    render(<LoginPageContent />);

    fireEvent.click(screen.getByRole('button', { name: 'Chiqish' }));

    expect(setSessionMock).toHaveBeenCalledWith(null);
    expect(setRestaurantContextMock).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith('/restaurant-login?next=%2Fmonitor%2Fqueue', { replace: true });
  });
});
