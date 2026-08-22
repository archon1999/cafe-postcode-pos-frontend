// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PosServicePriceDialog } from './PosServicePriceDialog';

afterEach(cleanup);

describe('PosServicePriceDialog item note', () => {
  it('submits the manual price and trimmed item note together', () => {
    const onConfirm = vi.fn();
    render(
      <PosServicePriceDialog
        allowItemNote
        item={{ id: 'service-1', name: 'Yetkazib berish' }}
        locale="uz"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText('Narx'), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText('Mahsulot uchun izoh'), { target: { value: '  Chilonzor  ' } });
    fireEvent.click(screen.getByRole('button', { name: "Buyurtmaga qo'shish" }));

    expect(onConfirm).toHaveBeenCalledWith(50_000, 'Chilonzor');
  });
});
