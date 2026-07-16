export type MutationErrorPayload = {
  displayName?: string[];
  detail?: string;
  payment?: {
    providerPayload?: Record<string, unknown> | null;
    provider_payload?: Record<string, unknown> | null;
  };
};

export function getMutationErrorPayload(error: unknown) {
  return (error as { response?: { data?: MutationErrorPayload } })?.response?.data;
}

export function getMutationErrorDetail(error: unknown) {
  return getMutationErrorPayload(error)?.detail ?? '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function responseHttpStatus(exchange: unknown) {
  const exchangeRecord = asRecord(exchange);
  const response = asRecord(exchangeRecord?.response);
  const status = response?.httpStatus ?? response?.http_status;
  return typeof status === 'number' ? status : Number(status || 0);
}

export function getMartaNon2xxDebugJson(error: unknown) {
  const errorResponse = getMutationErrorPayload(error);
  const payment = errorResponse?.payment;
  const providerPayload = asRecord(payment?.providerPayload ?? payment?.provider_payload);
  if (!providerPayload || providerPayload.provider !== 'marta-softpos') {
    return '';
  }

  const debug = asRecord(providerPayload.debug);
  if (!debug || !Object.values(debug).some((exchange) => responseHttpStatus(exchange) >= 300)) {
    return '';
  }

  return JSON.stringify(
    {
      detail: errorResponse?.detail ?? providerPayload.detail ?? providerPayload.message ?? '',
      provider: providerPayload.provider,
      status: providerPayload.status,
      requestId: providerPayload.requestId ?? providerPayload.request_id,
      debug,
    },
    null,
    2,
  );
}
