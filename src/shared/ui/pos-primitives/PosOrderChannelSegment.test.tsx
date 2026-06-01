// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PosOrderChannelSegment } from './PosOrderChannelSegment';

describe('PosOrderChannelSegment', () => {
  it('renders and switches delivery and takeaway builder channels', () => {
    const onChange = vi.fn();

    render(
      <PosOrderChannelSegment
        takeawayLabel="Olib ketish"
        channel="delivery"
        items={[
          { value: 'takeaway', label: 'Olib ketish' },
          { value: 'delivery', label: 'Yetkazib berish' },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Yetkazib berish' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Olib ketish' }));

    expect(onChange).toHaveBeenCalledWith('takeaway');
  });
});
