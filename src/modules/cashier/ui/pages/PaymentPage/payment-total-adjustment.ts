export type PercentageDiscount = {
  discountAmount: number;
  finalTotal: number;
  isValid: boolean;
  percent: number | null;
};

export function calculatePercentageDiscount(calculatedTotal: number, rawPercent: string): PercentageDiscount {
  const normalized = rawPercent.trim().replace(',', '.');
  if (!normalized) {
    return { discountAmount: 0, finalTotal: calculatedTotal, isValid: false, percent: null };
  }

  const percent = Number(normalized);
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100) {
    return { discountAmount: 0, finalTotal: calculatedTotal, isValid: false, percent: null };
  }

  const discountAmount = Math.round((calculatedTotal * percent) / 100);
  const finalTotal = calculatedTotal - discountAmount;
  if (finalTotal <= 0) {
    return { discountAmount, finalTotal, isValid: false, percent };
  }

  return { discountAmount, finalTotal, isValid: true, percent };
}
