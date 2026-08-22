// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PosItemNoteDialog } from './PosItemNoteDialog';

afterEach(cleanup);

describe('PosItemNoteDialog', () => {
  it('trims and saves an item-level note', () => {
    const onSave = vi.fn();
    render(<PosItemNoteDialog itemLabel="Lavash × 1" locale="uz" onClose={vi.fn()} onSave={onSave} open />);

    expect(screen.getByText('Mahsulot uchun izoh')).toBeTruthy();
    expect(screen.getByPlaceholderText('Masalan: piyozsiz, kamroq tuz')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mahsulot uchun izoh'), { target: { value: '  Piyozsiz  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Izohni saqlash' }));

    expect(onSave).toHaveBeenCalledWith('Piyozsiz');
  });

  it('can remove an existing note and limits input to 500 characters', () => {
    const onSave = vi.fn();
    render(
      <PosItemNoteDialog
        initialNote="Kamroq tuz"
        itemLabel="Osh × 1"
        locale="uz"
        onClose={vi.fn()}
        onSave={onSave}
        open
      />,
    );

    const input = screen.getByLabelText('Mahsulot uchun izoh') as HTMLTextAreaElement;
    expect(input.maxLength).toBe(500);
    fireEvent.click(screen.getByRole('button', { name: 'Izohni o‘chirish' }));

    expect(onSave).toHaveBeenCalledWith('');
  });
});
