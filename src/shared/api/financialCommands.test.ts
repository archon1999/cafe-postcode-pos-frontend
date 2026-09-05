// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeFinancialCommand, recoverFinancialCommand } from './financialCommands';

const environment = vi.hoisted(() => ({ origin: 'http://127.0.0.1:18183/v1', userId: 'cashier-1' }));
vi.mock('./apiUrl', () => ({
  resolveApiBaseUrl: () => environment.origin,
  resolveRemoteApiBaseUrl: () => 'https://backend.test/api/v1',
}));
vi.mock('./edgeConnection', () => ({ readOrCreateEdgeTerminalIdentity: () => ({ terminalId: 'terminal-1' }) }));
vi.mock('modules/auth/data-access/storage/session.storage', () => ({
  readStoredSession: () => ({ user: { id: environment.userId }, restaurantContext: { restaurantId: 'restaurant-1' } }),
}));

const path = '/pos/billing/orders/order-1/pay/';
const payload = { method: 'cash', amount: 15000, registerFiscal: true };
const success = { order: { id: 'order-1' }, payment: { id: 'payment-1', amount: 15000 } };
function withCapability(get: ReturnType<typeof vi.fn>, post: ReturnType<typeof vi.fn>) {
  return {
    get: async <T>(url: string): Promise<T> =>
      url === '/system/status' ? ({ status: { agent: { financialCommandVersion: 1 } } } as T) : get(url),
    post,
  };
}
function record() {
  const key = Object.keys(localStorage).find((item) => item.startsWith('cafe-pos.financial-command.v1:'));
  return key
    ? {
        key,
        value: JSON.parse(localStorage.getItem(key)!) as { commandId: string; payload: string; payloadSha256: string },
      }
    : null;
}

describe('durable financial commands', () => {
  it('preserves original business errors when the Agent adds command metadata to the outer error body', async () => {
    const post = vi.fn().mockImplementation(async (_url, _body, commandId) => {
      throw {
        response: {
          status: 409,
          data: {
            code: 'SERVICE_FEE_QUOTE_STALE',
            detail: 'Quote changed',
            financialCommand: { commandId, state: 'failed', stage: 'payment', manualConfirmationAllowed: false },
          },
        },
      };
    });
    const get = vi.fn();
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toMatchObject({
      response: {
        status: 409,
        data: { code: 'SERVICE_FEE_QUOTE_STALE', detail: 'Quote changed', financialCommand: { state: 'failed' } },
      },
    });
    expect(get).not.toHaveBeenCalled();
    expect(record()).toBeNull();
  });
  it('requires the financial command capability before sending a new payment', async () => {
    const transport = { get: vi.fn().mockResolvedValue({ status: { agent: { version: '1.1.15' } } }), post: vi.fn() };
    await expect(executeFinancialCommand(path, payload, transport)).rejects.toMatchObject({
      response: { data: { code: 'FINANCIAL_AGENT_UPDATE_REQUIRED' } },
    });
    expect(transport.post).not.toHaveBeenCalled();
    expect(record()).toBeNull();
  });
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubGlobal('crypto', webcrypto);
    environment.origin = 'http://127.0.0.1:18183/v1';
    environment.userId = 'cashier-1';
  });

  it('persists the original ID/body before posting and reuses them after a lost response', async () => {
    let commandId = '';
    const post = vi
      .fn()
      .mockImplementationOnce(async (_path, body, id) => {
        commandId = id;
        expect(record()?.value.commandId).toBe(id);
        expect(JSON.parse(record()!.value.payload)).toEqual(body);
        expect(record()?.value.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
        throw new Error('connection lost');
      })
      .mockResolvedValueOnce(success);
    const get = vi
      .fn()
      .mockImplementation(async () => ({ commandId, state: 'unknown', stage: 'fiscal', retryAllowed: true }));
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toMatchObject({
      response: { data: { financialCommand: { state: 'unknown' } } },
    });
    expect(
      await executeFinancialCommand(
        path,
        { registerFiscal: true, amount: 15000, method: 'cash' },
        withCapability(get, post),
      ),
    ).toEqual(success);
    expect(post).toHaveBeenLastCalledWith(path, payload, commandId);
    expect(post).toHaveBeenCalledTimes(2);
    expect(record()).toBeNull();
  });

  it('recovers a committed result after reload without starting another payment', async () => {
    const post = vi.fn().mockRejectedValue(new Error('lost response'));
    const get = vi.fn().mockRejectedValue(new Error('agent restarting'));
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toThrow();
    const commandId = record()!.value.commandId;
    const reloaded = await import('./financialCommands');
    get.mockResolvedValue({ commandId, state: 'succeeded', responseStatus: 201, response: success });
    expect(await reloaded.recoverFinancialCommand(path, withCapability(get, post))).toEqual(success);
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenLastCalledWith(`/pos/financial-commands/${encodeURIComponent(commandId)}/`);
  });

  it('blocks changed amount and manual override while the original payment is unresolved', async () => {
    const post = vi.fn().mockRejectedValue(new Error('lost response'));
    const get = vi.fn().mockRejectedValue(new Error('agent restarting'));
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toThrow();
    for (const changed of [
      { ...payload, amount: 16000 },
      { ...payload, manualCardOverride: true },
    ]) {
      await expect(executeFinancialCommand(path, changed, withCapability(get, post))).rejects.toMatchObject({
        response: { data: { code: 'FINANCIAL_COMMAND_PAYLOAD_CHANGED' } },
      });
    }
    expect(post).toHaveBeenCalledTimes(1);
    expect(record()).not.toBeNull();
  });

  it('keeps the command when a success lookup omits the durable response', async () => {
    const post = vi.fn().mockRejectedValue(new Error('lost response'));
    const get = vi.fn().mockRejectedValue(new Error('agent restarting'));
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toThrow();
    get.mockResolvedValue({ commandId: record()!.value.commandId, state: 'succeeded', responseStatus: 201 });
    await expect(recoverFinancialCommand(path, withCapability(get, post), true)).rejects.toThrow();
    expect(record()).not.toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not recover another signed-in cashier’s command', async () => {
    const post = vi.fn().mockRejectedValue(new Error('lost response'));
    const get = vi.fn().mockRejectedValue(new Error('agent restarting'));
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toThrow();
    get.mockClear();
    environment.userId = 'cashier-2';
    expect(await recoverFinancialCommand(path, withCapability(get, post), true)).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(record()).not.toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not interpret a legacy or proxy 404 as proof that a command never ran', async () => {
    const post = vi.fn().mockRejectedValue(new Error('lost response'));
    const get = vi.fn().mockRejectedValue({ response: { status: 404, data: { detail: 'Not found' } } });
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toThrow();
    await expect(recoverFinancialCommand(path, withCapability(get, post), true)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
    expect(record()).not.toBeNull();
  });

  it('reposts only the same saved ID when the Agent explicitly confirms not-found', async () => {
    const post = vi.fn().mockRejectedValueOnce(new Error('request never arrived')).mockResolvedValueOnce(success);
    const get = vi.fn().mockRejectedValue({ response: { status: 404, data: { code: 'FINANCIAL_COMMAND_NOT_FOUND' } } });
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toThrow();
    const commandId = record()!.value.commandId;
    await expect(recoverFinancialCommand(path, withCapability(get, post), false)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
    expect(await recoverFinancialCommand(path, withCapability(get, post), true)).toEqual(success);
    expect(post).toHaveBeenLastCalledWith(path, payload, commandId);
  });

  it('retains unknown commands when the Agent does not authorize a retry', async () => {
    const post = vi.fn().mockRejectedValue(new Error('lost response'));
    const get = vi.fn().mockImplementation(async () => ({
      commandId: record()!.value.commandId,
      state: 'unknown',
      retryAllowed: false,
      manualConfirmationAllowed: false,
    }));
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toThrow();
    await expect(recoverFinancialCommand(path, withCapability(get, post), true)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('fails before the physical request when browser persistence fails', async () => {
    const transport = {
      get: vi.fn().mockResolvedValue({ status: { agent: { financialCommandVersion: 1 } } }),
      post: vi.fn(),
    };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    await expect(executeFinancialCommand(path, payload, transport)).rejects.toMatchObject({
      response: { data: { code: 'FINANCIAL_COMMAND_STORAGE_UNAVAILABLE' } },
    });
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('rejects corrupted frozen payload rather than changing its hash and replaying it', async () => {
    const post = vi.fn().mockRejectedValue(new Error('lost response'));
    const get = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toThrow();
    const stored = record()!;
    localStorage.setItem(
      stored.key,
      JSON.stringify({
        ...stored.value,
        origin: environment.origin,
        path,
        payload: JSON.stringify({ ...payload, amount: 1 }),
      }),
    );
    await expect(recoverFinancialCommand(path, withCapability(get, post), true)).rejects.toMatchObject({
      response: { data: { code: 'FINANCIAL_COMMAND_STORAGE_INVALID' } },
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not silently execute physical financial work on the remote backend', async () => {
    environment.origin = 'https://backend.test/api/v1';
    const transport = {
      get: vi.fn().mockResolvedValue({ status: { agent: { financialCommandVersion: 1 } } }),
      post: vi.fn(),
    };
    await expect(executeFinancialCommand(path, payload, transport)).rejects.toMatchObject({
      response: { data: { code: 'FINANCIAL_AGENT_REQUIRED' } },
    });
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('explains a preflight update before creating a payment intent', async () => {
    const transport = {
      get: vi.fn().mockRejectedValue({ response: { status: 503, data: { code: 'AGENT_UPDATING' } } }),
      post: vi.fn(),
    };
    await expect(executeFinancialCommand(path, payload, transport)).rejects.toMatchObject({
      response: { data: { code: 'AGENT_UPDATING' } },
    });
    expect(transport.post).not.toHaveBeenCalled();
    expect(record()).toBeNull();
  });

  it('retains the original command across update admission and resumes it once', async () => {
    const updating = { response: { status: 503, data: { code: 'AGENT_UPDATING' } } };
    const post = vi.fn().mockRejectedValueOnce(updating).mockResolvedValueOnce({ ok: true });
    const get = vi.fn().mockRejectedValue(updating);
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).rejects.toMatchObject({
      response: { data: { code: 'AGENT_UPDATING' } },
    });
    const commandId = record()!.value.commandId;
    get.mockRejectedValue({ response: { status: 404, data: { code: 'FINANCIAL_COMMAND_NOT_FOUND' } } });
    await expect(executeFinancialCommand(path, payload, withCapability(get, post))).resolves.toEqual({ ok: true });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][2]).toBe(commandId);
    expect(post.mock.calls[1][2]).toBe(commandId);
    expect(record()).toBeNull();
  });
});
