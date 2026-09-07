export function isValidOpeningCash(value: string): boolean {
  const amount = Number(value);
  return value.trim() !== '' && Number.isInteger(amount) && amount >= 0 && amount <= 2_147_483_647;
}
