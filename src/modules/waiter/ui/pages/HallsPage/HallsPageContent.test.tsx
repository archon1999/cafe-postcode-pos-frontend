/* @vitest-environment jsdom */

import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HallsPageContent } from './HallsPageContent';

const mockNavigate = vi.fn();
const mockOpenSessionMutate = vi.fn();
const mockReserveTableMutate = vi.fn();

type SessionState = {
  permissionCodes: string[];
};

let sessionState: SessionState = {
  permissionCodes: ['pos_halls.view', 'pos_tables.manage', 'pos_table_reservations.manage'],
};

const hallPayload = [
  {
    id: 'hall-1',
    name: 'Asosiy zal',
    gridColumns: 4,
    zones: [],
    tables: [
      {
        id: 'table-1',
        name: 'Asosiy zal 1',
        tableNumber: 1,
        seatCount: 4,
        status: 'available',
        shapeVariant: 'seat4_square',
        positionX: 0,
        positionY: 0,
        width: 1,
        height: 1,
      },
      {
        id: 'table-2',
        name: 'Asosiy zal 2',
        tableNumber: 2,
        seatCount: 4,
        status: 'reserved',
        shapeVariant: 'seat4_square',
        positionX: 1,
        positionY: 0,
        width: 1,
        height: 1,
      },
    ],
  },
];

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('modules/auth', async () => {
  const actual = await vi.importActual<typeof import('modules/auth')>('modules/auth');
  return {
    ...actual,
    usePosSession: () => ({
      session: {
        token: 'token',
        restaurantAccessActive: true,
        featureConfig: {
          id: 'feature-1',
          hallEnabled: true,
          kitchenEnabled: true,
          cashierEnabled: true,
          ownerDashboardEnabled: false,
          orderEntryMode: 'hall',
          kitchenMode: 'display',
          enabledModules: [],
          enabledRoles: [],
          allowedPermissionCodes: [],
          allowedRoleCodes: [],
          restaurantAccessActive: true,
        },
        user: {
          id: 'user-1',
          username: 'waiter',
          fullName: 'Waiter User',
          restaurantAccessActive: true,
          permissionCodes: sessionState.permissionCodes,
          role: { id: 'role-1', name: 'Waiter' },
        },
      },
      locale: 'uz',
      setLocale: vi.fn(),
      setSession: vi.fn(),
      themeMode: 'light',
      setThemeMode: vi.fn(),
    }),
  };
});

vi.mock('modules/waiter/application', () => ({
  useWaiterHallsQuery: () => ({
    data: hallPayload,
    isLoading: false,
  }),
  useOpenTableSessionMutation: () => ({
    mutate: mockOpenSessionMutate,
    isPending: false,
  }),
  useReserveTableMutation: () => ({
    mutate: mockReserveTableMutate,
    isPending: false,
  }),
}));

vi.mock('shared/layout/PosPageFrame', () => ({
  PosPageFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('shared/ui/pos-primitives', () => ({
  PosHallsPageSkeleton: () => <div>loading</div>,
  PosIconAction: ({ onClick }: { onClick?: () => void }) => <button onClick={onClick}>action</button>,
  PosLegendPill: ({ label }: { label: string }) => <span>{label}</span>,
  PosSectionTabs: ({
    items,
    value,
    onChange,
  }: {
    items: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <div>
      {items.map((item) => (
        <button
          key={item.value}
          data-active={item.value === value}
          onClick={() => onChange(item.value)}
          type="button">
          {item.label}
        </button>
      ))}
    </div>
  ),
  PosSettingsMenu: () => null,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <HallsPageContent />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  mockNavigate.mockReset();
  mockOpenSessionMutate.mockReset();
  mockReserveTableMutate.mockReset();
  sessionState = {
    permissionCodes: ['pos_halls.view', 'pos_tables.manage', 'pos_table_reservations.manage'],
  };
});

describe('HallsPageContent', () => {
  it('shows the reserve button when the user has reservation permission', async () => {
    sessionState = {
      permissionCodes: ['pos_halls.view', 'pos_table_reservations.manage'],
    };

    renderPage();

    fireEvent.click(screen.getByTestId('hall-table-1'));

    expect(screen.getByRole('button', { name: "Stolni bronlash" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stolni ochish' })).toBeNull();
  });

  it('does not open reserved tables for users without reservation permission', async () => {
    sessionState = {
      permissionCodes: ['pos_halls.view', 'pos_tables.manage'],
    };

    renderPage();

    fireEvent.click(screen.getByTestId('hall-table-2'));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
