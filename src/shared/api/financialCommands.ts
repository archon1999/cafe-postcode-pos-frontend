import { readStoredSession } from 'modules/auth/data-access/storage/session.storage';

import { resolveApiBaseUrl, resolveRemoteApiBaseUrl } from './apiUrl';
import { readOrCreateEdgeTerminalIdentity } from './edgeConnection';

export type FinancialCommandState = 'processing' | 'succeeded' | 'failed' | 'unknown';
export type FinancialCommandStatus = {
  commandId: string;
  state: FinancialCommandState;
  stage?: 'payment' | 'fiscal' | 'shift' | string;
  responseStatus?: number;
  response?: unknown;
  retryAllowed?: boolean;
  manualConfirmationAllowed?: boolean;
};

type StoredCommand = {
  commandId: string;
  path: string;
  origin: string;
  payload: string;
  payloadSha256: string;
  createdAt: string;
};

type Transport = {
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, payload: unknown, commandId: string) => Promise<T>;
};

const STORAGE_PREFIX = 'cafe-pos.financial-command.v1:';
const flights = new Map<string, { promise: Promise<unknown>; payload?: string }>();

export class FinancialCommandError extends Error {
  readonly response: { status: number; data: Record<string, unknown> };

  constructor(command: StoredCommand | null, status: Partial<FinancialCommandStatus>, detail: string, code?: string) {
    super(detail);
    this.name = 'FinancialCommandError';
    this.response = {
      status: status.responseStatus ?? 409,
      data: {
        ...(status.response && typeof status.response === 'object' ? status.response : {}),
        code:
          code ??
          (typeof (status.response as { code?: unknown } | undefined)?.code === 'string'
            ? (status.response as { code: string }).code
            : status.state === 'failed'
              ? 'FINANCIAL_COMMAND_FAILED'
              : 'FINANCIAL_COMMAND_UNKNOWN'),
        detail,
        financialCommand: { ...status, commandId: command?.commandId ?? status.commandId },
        originalCommand: command ? JSON.parse(command.payload) : undefined,
      },
    };
  }
}

export function isFinancialMutation(path: string) {
  return /^\/pos\/billing\/(?:orders\/[^/]+\/pay|payments\/[^/]+\/retry-fiscal|[^/]+\/refund|expenses\/[^/]+\/void|shifts\/open|shifts\/current\/(?:close|expenses)|fiscal-shifts\/(?:open|close))\/$/.test(
    path,
  );
}

function storageKey(path: string) {
  const session = readStoredSession();
  const { terminalId } = readOrCreateEdgeTerminalIdentity();
  return `${STORAGE_PREFIX}${JSON.stringify([terminalId, session?.restaurantContext?.restaurantId, session?.user.id, path])}`;
}

function canonicalJSON(value: unknown): string {
  const normalized = JSON.parse(JSON.stringify(value ?? {})) as unknown;
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, sort(child)]),
      );
    }
    return item;
  };
  return JSON.stringify(sort(normalized));
}

async function payloadHash(payload: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readCommand(path: string): StoredCommand | null {
  const raw = window.localStorage.getItem(storageKey(path));
  if (!raw) return null;
  try {
    const command = JSON.parse(raw) as StoredCommand;
    if (command.path !== path || !command.commandId || !command.payload || !command.payloadSha256 || !command.origin)
      throw new Error();
    return command;
  } catch {
    throw new FinancialCommandError(
      null,
      { state: 'unknown' },
      'Saqlangan moliyaviy amalni o‘qib bo‘lmadi. Yangi to‘lovdan oldin administrator tekshiruvi kerak.',
      'FINANCIAL_COMMAND_STORAGE_INVALID',
    );
  }
}

function removeCommand(command: StoredCommand) {
  // Do not clear a newer command opened by another browser tab.
  if (readCommand(command.path)?.commandId === command.commandId)
    window.localStorage.removeItem(storageKey(command.path));
}

function statusError(command: StoredCommand, status: FinancialCommandStatus) {
  const payload = status.response as { detail?: string } | undefined;
  return new FinancialCommandError(
    command,
    status,
    payload?.detail ||
      (status.state === 'failed'
        ? 'Moliyaviy amal bajarilmadi.'
        : 'Amal natijasi hali tasdiqlanmadi. Qayta to‘lamang; avval amal holatini tekshiring.'),
  );
}

async function validateCommand(command: StoredCommand) {
  if (command.origin !== resolveApiBaseUrl()) {
    throw new FinancialCommandError(
      command,
      { state: 'unknown' },
      'Amal boshlangan Local Agent bilan ulanishni tiklang.',
      'FINANCIAL_COMMAND_OWNER_CHANGED',
    );
  }
  if ((await payloadHash(command.payload)) !== command.payloadSha256) {
    throw new FinancialCommandError(
      command,
      { state: 'unknown' },
      'Saqlangan amal ma’lumotlari o‘zgargan. Administrator tekshiruvi kerak.',
      'FINANCIAL_COMMAND_STORAGE_INVALID',
    );
  }
}

function responseError(error: unknown) {
  return (error as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
}

function agentUpdatingError(command: StoredCommand | null) {
  return new FinancialCommandError(
    command,
    { state: command ? 'unknown' : 'failed' },
    command
      ? 'Local Agent yangilanmoqda. Tugagach saqlangan amal holatini qayta tekshiring.'
      : 'Local Agent yangilanmoqda. Bir necha soniyadan keyin qayta urinib ko‘ring. To‘lov yuborilmadi.',
    'AGENT_UPDATING',
  );
}

async function requireFinancialCapability(transport: Transport, command: StoredCommand | null = null) {
  try {
    const response = await transport.get<{ status?: { agent?: { financialCommandVersion?: number } } }>(
      '/system/status',
    );
    if (response.status?.agent?.financialCommandVersion === 1) return;
  } catch (error) {
    if (responseError(error)?.data?.code === 'AGENT_UPDATING') throw agentUpdatingError(command);
    // An unavailable capability is not permission to use a legacy financial path.
  }
  throw new FinancialCommandError(
    command,
    { state: command ? 'unknown' : 'failed' },
    'Local Agentni moliyaviy amallarni tiklashni qo‘llaydigan versiyaga yangilang va ulanishni tekshiring. To‘lov yuborilmadi.',
    'FINANCIAL_AGENT_UPDATE_REQUIRED',
  );
}

async function lookup(command: StoredCommand, transport: Transport): Promise<FinancialCommandStatus | null> {
  try {
    const status = await transport.get<FinancialCommandStatus>(
      `/pos/financial-commands/${encodeURIComponent(command.commandId)}/`,
    );
    if (
      status.commandId !== command.commandId ||
      !['processing', 'succeeded', 'failed', 'unknown'].includes(status.state) ||
      (status.state === 'succeeded' &&
        (!status.response || !status.responseStatus || status.responseStatus < 200 || status.responseStatus >= 300))
    ) {
      throw new Error('Invalid financial command status');
    }
    return status;
  } catch (error) {
    const response = responseError(error);
    if (response?.data?.code === 'AGENT_UPDATING') throw agentUpdatingError(command);
    if (response?.status === 404 && response.data?.code === 'FINANCIAL_COMMAND_NOT_FOUND') return null;
    throw new FinancialCommandError(
      command,
      { state: 'unknown' },
      'Local Agentdan amal natijasini aniqlab bo‘lmadi. Amal saqlangan; yangi to‘lov yuborilmadi.',
    );
  }
}

async function send<T>(command: StoredCommand, transport: Transport): Promise<T> {
  try {
    const result = await transport.post<T>(command.path, JSON.parse(command.payload), command.commandId);
    removeCommand(command);
    return result;
  } catch (error) {
    const response = responseError(error);
    const embedded = response?.data?.financialCommand as FinancialCommandStatus | undefined;
    const status =
      embedded?.commandId === command.commandId
        ? { ...embedded, responseStatus: response?.status, response: response?.data }
        : await lookup(command, transport);
    if (status?.state === 'succeeded') {
      removeCommand(command);
      return status.response as T;
    }
    if (status?.state === 'failed') {
      removeCommand(command);
      throw statusError(command, status);
    }
    throw statusError(command, status ?? { commandId: command.commandId, state: 'unknown', retryAllowed: true });
  }
}

async function resume<T>(command: StoredCommand, transport: Transport, allowRetry: boolean): Promise<T> {
  await validateCommand(command);
  const status = await lookup(command, transport);
  if (status?.state === 'succeeded') {
    removeCommand(command);
    return status.response as T;
  }
  if (status?.state === 'failed') {
    removeCommand(command);
    throw statusError(command, status);
  }
  if (allowRetry && (!status || status.retryAllowed === true)) {
    await requireFinancialCapability(transport, command);
    return send<T>(command, transport);
  }
  throw statusError(command, status ?? { commandId: command.commandId, state: 'unknown', retryAllowed: true });
}

async function serialized<T>(key: string, work: () => Promise<T>, payload?: string): Promise<T> {
  const active = flights.get(key);
  if (active) {
    if (active.payload && payload && active.payload !== payload)
      throw new FinancialCommandError(
        null,
        { state: 'unknown' },
        'Boshqa moliyaviy amal bajarilmoqda. Uning natijasini kuting.',
        'FINANCIAL_COMMAND_PAYLOAD_CHANGED',
      );
    return active.promise as Promise<T>;
  }
  const task = navigator.locks?.request ? navigator.locks.request(key, work) : work();
  flights.set(key, { promise: task, payload });
  try {
    return await task;
  } finally {
    flights.delete(key);
  }
}

export async function recoverFinancialCommand<T>(
  path: string,
  transport: Transport,
  allowRetry = false,
): Promise<T | null> {
  if (!readCommand(path)) return null;
  return serialized(storageKey(path), async () => {
    const command = readCommand(path);
    return command ? resume<T>(command, transport, allowRetry) : null;
  });
}

export async function executeFinancialCommand<T>(path: string, payload: unknown, transport: Transport): Promise<T> {
  const wirePayload = canonicalJSON(payload);
  return serialized(
    storageKey(path),
    async () => {
      const existing = readCommand(path);
      if (existing) {
        if (existing.payload !== wirePayload) {
          throw new FinancialCommandError(
            existing,
            { state: 'unknown' },
            'Oldingi amal natijasi noma’lum. Summani yoki to‘lov turini o‘zgartirishdan oldin uning holatini tekshiring.',
            'FINANCIAL_COMMAND_PAYLOAD_CHANGED',
          );
        }
        return resume<T>(existing, transport, true);
      }
      if (resolveApiBaseUrl() === resolveRemoteApiBaseUrl()) {
        throw new FinancialCommandError(
          null,
          { state: 'failed' },
          'Moliyaviy amal uchun Local Agentga ulaning.',
          'FINANCIAL_AGENT_REQUIRED',
        );
      }
      await requireFinancialCapability(transport);
      const command: StoredCommand = {
        commandId: `pos:${crypto.randomUUID()}`,
        path,
        origin: resolveApiBaseUrl(),
        payload: wirePayload,
        payloadSha256: await payloadHash(wirePayload),
        createdAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(storageKey(path), JSON.stringify(command));
      } catch {
        throw new FinancialCommandError(
          null,
          { state: 'failed' },
          'Amalni qurilmada saqlab bo‘lmadi. To‘lov yuborilmadi.',
          'FINANCIAL_COMMAND_STORAGE_UNAVAILABLE',
        );
      }
      return send<T>(command, transport);
    },
    wirePayload,
  );
}
