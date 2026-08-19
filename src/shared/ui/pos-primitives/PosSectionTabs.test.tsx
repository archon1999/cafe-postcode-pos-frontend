// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PosSectionTabs } from './PosSectionTabs';

const categories = Array.from({ length: 12 }, (_, index) => ({
  value: `category-${index + 1}`,
  label: index === 11 ? '' : `Category ${index + 1}`,
}));

describe('PosSectionTabs', () => {
  it('keeps every category reachable through arrow and wheel navigation', () => {
    render(<PosSectionTabs value="category-1" items={categories} onChange={vi.fn()} scrollable />);

    expect(screen.getByRole('button', { name: 'Category 11' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '#12' })).toBeTruthy();

    const rail = screen.getByRole('region', { name: 'Kategoriyalar' });
    Object.defineProperties(rail, {
      clientWidth: { configurable: true, value: 600 },
      scrollWidth: { configurable: true, value: 1_800 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Keyingi kategoriyalar' }));
    expect(rail.scrollLeft).toBe(450);

    fireEvent.wheel(rail, { deltaY: 120, deltaX: 0 });
    expect(rail.scrollLeft).toBe(570);

    fireEvent.click(screen.getByRole('button', { name: 'Oldingi kategoriyalar' }));
    expect(rail.scrollLeft).toBe(120);
  });
});
