const DELIVERY_PHONE_DIGIT_LIMIT = 9;
const DELIVERY_PHONE_PATTERN = /^\d{2}-\d{3}-\d{2}-\d{2}$/;

export function formatDeliveryPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, DELIVERY_PHONE_DIGIT_LIMIT);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return parts.join('-');
}

export function isValidDeliveryPhone(value: string) {
  return DELIVERY_PHONE_PATTERN.test(value.trim());
}

export function normalizeDeliveryAddress(value: string) {
  return value.trim();
}
