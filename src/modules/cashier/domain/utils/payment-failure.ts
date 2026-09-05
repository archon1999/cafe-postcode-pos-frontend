export type PaymentFailureState = {
  state: 'failed' | 'unknown';
  stage: string;
  commandId?: string;
  code?: string;
  retryAllowed: boolean;
  manualConfirmationAllowed: boolean;
};

export function getPaymentFailureState(error: unknown): PaymentFailureState {
  const payload = (error as { response?: { data?: { code?: string; financialCommand?: Record<string, unknown> } } })
    ?.response?.data;
  const command = payload?.financialCommand;
  return {
    state: command?.state === 'failed' ? 'failed' : 'unknown',
    stage: typeof command?.stage === 'string' ? command.stage : 'payment',
    commandId: typeof command?.commandId === 'string' ? command.commandId : undefined,
    code: payload?.code,
    // Checking status is always safe; a mutation retry is authorized by the Agent.
    retryAllowed: command?.retryAllowed === true,
    manualConfirmationAllowed:
      command?.state === 'failed' &&
      (!command.stage || command.stage === 'payment') &&
      command.manualConfirmationAllowed === true,
  };
}
