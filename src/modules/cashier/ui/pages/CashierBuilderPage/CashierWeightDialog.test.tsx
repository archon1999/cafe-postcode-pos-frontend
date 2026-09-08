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

describe('portion quantities', () => {
  afterEach(cleanup);
  it.each(['0.5', '1', '1.5', '2', '2.5', '0,5'])('accepts %s pors', (value) => {
    const onConfirm = vi.fn();
    render(
      <CashierWeightDialog
        item={{ id: 'soup', name: 'Soup', price: 10000, saleUnit: 'pors' }}
        selections={[]}
        locale="uz"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByLabelText('Miqdor (pors)'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: "Buyurtmaga qo'shish" }));
    expect(onConfirm).toHaveBeenCalledWith(Number(value.replace(',', '.')), '');
  });
  it.each(['0.25', '1.2', '-0.5', '0.501'])('rejects %s pors', (value) => {
    render(
      <CashierWeightDialog
        item={{ id: 'soup', name: 'Soup', price: 10000, saleUnit: 'pors' }}
        selections={[]}
        locale="uz"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Miqdor (pors)'), { target: { value } });
    expect(screen.getByRole('button', { name: "Buyurtmaga qo'shish" })).toHaveProperty('disabled', true);
  });
  it('accepts zero as an empty selection without creating an order row', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <CashierWeightDialog
        item={{ id: 'soup', name: 'Soup', price: 10000, saleUnit: 'pors' }}
        selections={[]}
        locale="uz"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByLabelText('Miqdor (pors)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: "Buyurtmaga qo'shish" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
