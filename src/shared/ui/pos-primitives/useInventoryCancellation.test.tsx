// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { inventoryCopy } from 'shared/pos/inventory';

import { useInventoryCancellation } from './useInventoryCancellation';

describe('inventory cancellation choices', () => {
  afterEach(cleanup);
  function Flow({ consumed, remove }: { consumed: boolean; remove: ReturnType<typeof vi.fn> }) {
    const flow = useInventoryCancellation(
      [{ id: 'row-1', catalogItemName: 'Osh', inventoryConsumed: consumed }],
      remove,
      'uz',
    );
    return (
      <>
        <button onClick={() => flow.removeItem('row-1')}>remove</button>
        {flow.inventoryCancellationDialog}
      </>
    );
  }

  it('does not restore ingredients or submit a request until the operator chooses', () => {
    const remove = vi.fn();
    render(<Flow consumed remove={remove} />);
    fireEvent.click(screen.getByText('remove'));
    expect(remove).not.toHaveBeenCalled();
    expect((screen.getByRole('radio', { name: inventoryCopy.uz.waste }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: inventoryCopy.uz.notPrepared }));
    fireEvent.click(screen.getByRole('button', { name: inventoryCopy.uz.confirm }));
    expect(remove).toHaveBeenCalledExactlyOnceWith('row-1', 'not_prepared');
  });

  it('keeps unsent draft removal immediate and leaves stock unchanged on dialog dismissal', () => {
    const remove = vi.fn();
    const view = render(<Flow consumed={false} remove={remove} />);
    fireEvent.click(screen.getByText('remove'));
    expect(remove).toHaveBeenCalledExactlyOnceWith('row-1');
    remove.mockClear();
    view.rerender(<Flow consumed remove={remove} />);
    fireEvent.click(screen.getByText('remove'));
    fireEvent.click(screen.getByRole('button', { name: inventoryCopy.uz.close }));
    expect(remove).not.toHaveBeenCalled();
  });
});
