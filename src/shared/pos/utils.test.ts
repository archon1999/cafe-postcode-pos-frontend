import { describe, expect, it } from 'vitest';

import { formatPosItemQuantityLabel, formatPosQuantity, formatPosQuantityNumber } from './utils';

describe('POS quantity formatting', () => {
  it('normalizes backend decimal strings for piece products', () => {
    expect(formatPosQuantity('1.000', 'piece', 'uz')).toBe('1');
    expect(formatPosItemQuantityLabel('Burger', '3.000', 'piece', 'uz')).toBe('Burger (x3)');
  });

  it('shows kilogram values with up to three meaningful decimals', () => {
    expect(formatPosQuantity('1.400', 'kg', 'uz')).toBe('1,4 kg');
    expect(formatPosQuantity('0.125', 'kg', 'ru')).toBe('0,125 кг');
    expect(formatPosQuantityNumber('2.000', 'kg', 'uz')).toBe('2');
    expect(formatPosItemQuantityLabel('Baliq', '1.400', 'kg', 'uz')).toBe('Baliq (1,4 kg)');
  });
});

it('preserves half portions and the pors label in every POS locale', () => {
  for (const locale of ['uz', 'ru', 'uz-crl'] as const) {
    expect(formatPosQuantity('0.500', 'pors', locale)).toBe('0,5 pors');
    expect(formatPosItemQuantityLabel('Soup', '1.500', 'pors', locale)).toBe('Soup (1,5 pors)');
  }
});
