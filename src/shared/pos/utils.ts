import type { PosLocale } from '../locale/copy';

const localeMap: Record<PosLocale, string> = {
  uz: 'uz-UZ',
  'uz-crl': 'uz-Cyrl-UZ',
  ru: 'ru-RU',
};
const TASHKENT_TIMEZONE = 'Asia/Tashkent';

const currencyLabelMap: Record<PosLocale, string> = {
  uz: "so'm",
  'uz-crl': 'сўм',
  ru: 'сум',
};

export function formatMoney(value: number | string | null | undefined, locale: PosLocale) {
  const { amount, currency } = formatMoneyParts(value, locale);
  return `${amount} ${currency}`;
}

export function formatMoneyParts(value: number | string | null | undefined, locale: PosLocale) {
  const numericValue = Number(value ?? 0);
  return {
    amount: new Intl.NumberFormat(localeMap[locale]).format(numericValue),
    currency: currencyLabelMap[locale],
  };
}

export function formatCompactMoney(value: number | string | null | undefined, locale: PosLocale) {
  return formatMoney(value, locale);
}

export function normalizePosQuantity(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(3)) : 0;
}

export function addPosQuantities(left: number | string | null | undefined, right: number | string | null | undefined) {
  return normalizePosQuantity(normalizePosQuantity(left) + normalizePosQuantity(right));
}

export function formatTime(value: string | null | undefined, locale: PosLocale) {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat(localeMap[locale], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TASHKENT_TIMEZONE,
  }).format(date);
}

export function formatDateTime(value: string | null | undefined, locale: PosLocale) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(localeMap[locale], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TASHKENT_TIMEZONE,
  }).format(new Date(value));
}

export function formatDateLabel(value: Date, locale: PosLocale) {
  return new Intl.DateTimeFormat(localeMap[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TASHKENT_TIMEZONE,
  }).format(value);
}

export function formatElapsedMinutes(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  return `00:${minutes.toString().padStart(2, '0')}`;
}
