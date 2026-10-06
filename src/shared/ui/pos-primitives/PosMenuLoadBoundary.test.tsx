// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PosMenuLoadBoundary } from './PosMenuLoadBoundary';

afterEach(cleanup);

describe('menu loading failures', () => {
  it('shows an error with retry instead of a false empty catalog', () => {
    const retry = vi.fn();
    render(
      <PosMenuLoadBoundary failed hasData={false} isFetching={false} locale="uz" onRetry={retry}>
        <div>Empty catalog</div>
      </PosMenuLoadBoundary>,
    );
    expect(screen.queryByText('Empty catalog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Menyuni yuklab bo‘lmadi');
    fireEvent.click(screen.getByRole('button', { name: 'Yangilash' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('retains cached menu and disables repeated refresh clicks while fetching', () => {
    render(
      <PosMenuLoadBoundary failed hasData isFetching locale="ru" onRetry={vi.fn()}>
        <div>Cached Burger</div>
      </PosMenuLoadBoundary>,
    );
    expect(screen.getByText('Cached Burger')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Показано сохранённое меню');
    expect((screen.getByRole('button', { name: 'Обновить' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders the successful empty catalog without an error', () => {
    render(
      <PosMenuLoadBoundary failed={false} hasData isFetching={false} locale="uz" onRetry={vi.fn()}>
        <div>Empty catalog</div>
      </PosMenuLoadBoundary>,
    );
    expect(screen.getByText('Empty catalog')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
