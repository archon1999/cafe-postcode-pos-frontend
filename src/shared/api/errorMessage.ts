type ApiErrorPayload = Record<string, unknown>;

function firstText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = firstText(entry);
      if (text) {
        return text;
      }
    }
  }
  if (value && typeof value === 'object') {
    const record = value as ApiErrorPayload;
    for (const key of [
      'detail',
      'message',
      'closeFiscalShift',
      'close_fiscal_shift',
      'rawCode',
      'raw_code',
      'markings',
      'nonFieldErrors',
      'non_field_errors',
    ]) {
      const text = firstText(record[key]);
      if (text) {
        return text;
      }
    }
  }
  return '';
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const payload = (error as { response?: { data?: unknown } })?.response?.data;
  return firstText(payload) || (error instanceof Error ? error.message : '') || fallback;
}
