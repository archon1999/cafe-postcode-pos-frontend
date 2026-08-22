// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CashierWeightDialog } from './CashierWeightDialog';

vi.mock('@iconify/react', () => ({
  Icon: () => <span />,
}));

describe('CashierWeightDialog', () => {
  afterEach(cleanup);

  it('accepts comma decimals and returns the entered kilogram quantity', () => {
    const onConfirm = vi.fn();
    render(
      <CashierWeightDialog
        item={{
          id: 'fish-1',
          name: 'Baliq',
          price: 100000,
        }}
        selections={[]}
        locale="uz"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText('Miqdor (kg)'), { target: { value: '1,4' } });
    fireEvent.click(screen.getByRole('button', { name: "Buyurtmaga qo'shish" }));

    expect(onConfirm).toHaveBeenCalledWith(1.4, '');
  });

  it('submits a note together with a fractional kilogram quantity', () => {
    const onConfirm = vi.fn();
    render(
      <CashierWeightDialog
        allowItemNote
        item={{ id: 'fish-1', name: 'Baliq', price: 100000 }}
        selections={[]}
        locale="uz"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText('Miqdor (kg)'), { target: { value: '0,75' } });
    fireEvent.change(screen.getByLabelText('Mahsulot uchun izoh'), { target: { value: '  Tozalab bering  ' } });
    fireEvent.click(screen.getByRole('button', { name: "Buyurtmaga qo'shish" }));

    expect(onConfirm).toHaveBeenCalledWith(0.75, 'Tozalab bering');
  });

  it('rejects more than three decimal places', () => {
    render(
      <CashierWeightDialog
        item={{
          id: 'fish-1',
          name: 'Baliq',
          price: 100000,
        }}
        selections={[]}
        locale="uz"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Miqdor (kg)'), { target: { value: '1.2345' } });

    expect(screen.getByRole('button', { name: "Buyurtmaga qo'shish" })).toHaveProperty('disabled', true);
  });
});
