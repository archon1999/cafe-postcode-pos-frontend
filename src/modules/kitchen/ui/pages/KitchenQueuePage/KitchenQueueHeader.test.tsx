// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getPosCopy } from 'shared/locale/copy';

import { KitchenQueueHeader } from './KitchenQueueHeader';

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

vi.mock('shared/ui/pos-primitives', () => ({
  PosIconAction: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

describe('KitchenQueueHeader', () => {
  it('renders queue tabs without a back action', () => {
    const { container } = render(
      <KitchenQueueHeader
        activeCount={5}
        copy={getPosCopy('uz')}
        doneCount={3}
        isMobile={false}
        onLock={vi.fn()}
        onRefresh={vi.fn()}
        onSelectTab={vi.fn()}
        onSettings={vi.fn()}
        selectedTab="active"
      />,
    );

    expect(screen.getByRole('button', { name: 'Jarayonda (5)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Tayyor bo'lganlar (3)" })).toBeTruthy();
    expect(container.querySelector('[data-icon="solar:alt-arrow-left-bold"]')).toBeNull();
  });
});
