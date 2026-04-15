import qz from 'qz-tray';

import type { WaiterQzPrintJob } from 'modules/waiter/domain';
import { apiGet, apiPost } from 'shared/api/client';

type QzCertificateResponse = {
  certificate: string;
};

type QzSignatureResponse = {
  signature: string;
};

let isSecurityConfigured = false;
let connectionPromise: Promise<void> | null = null;

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function configureSecurity() {
  if (isSecurityConfigured) {
    return;
  }

  qz.security.setCertificatePromise(async () => {
    try {
      const response = await apiGet<QzCertificateResponse>('/pos/billing/qz/certificate/');
      return response.certificate;
    } catch {
      return '';
    }
  });
  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise(async (payload: string) => {
    try {
      const response = await apiPost<QzSignatureResponse>('/pos/billing/qz/sign/', { request: payload });
      return response.signature;
    } catch {
      return '';
    }
  });

  isSecurityConfigured = true;
}

async function ensureQzConnection() {
  configureSecurity();

  if (qz.websocket.isActive()) {
    return;
  }

  connectionPromise ??= qz.websocket.connect().catch((error: unknown) => {
    connectionPromise = null;
    throw new Error(`QZ Trayga ulanib bo'lmadi: ${getMessage(error)}`);
  });

  await connectionPromise;
}

function getConnectionType(job: WaiterQzPrintJob) {
  return job.config.connectionType ?? job.config.connection_type ?? (job.config.host ? 'socket' : 'system_printer');
}

function createQzConfig(job: WaiterQzPrintJob) {
  const connectionType = getConnectionType(job);
  const encoding = (job.encoding || 'cp437').toUpperCase();

  if (connectionType === 'socket') {
    const host = String(job.config.host || '').trim();
    if (!host) {
      throw new Error('QZ Tray LAN printer IP manzili topilmadi.');
    }

    return qz.configs.create(
      {
        host,
        port: job.config.port || 9100,
      },
      { encoding, jobName: 'POS prebill' },
    );
  }

  const printerName = String(job.config.printerName ?? job.config.printer_name ?? '').trim();
  if (!printerName) {
    throw new Error('QZ Tray printer nomi topilmadi.');
  }

  return qz.configs.create(printerName, { encoding, jobName: 'POS prebill' });
}

export async function printQzTrayJob(job: WaiterQzPrintJob | null | undefined) {
  if (!job) {
    throw new Error('Printer job topilmadi.');
  }

  await ensureQzConnection();

  const config = createQzConfig(job);
  await qz.print(config, [
    {
      type: 'raw',
      format: 'command',
      flavor: job.flavor,
      data: job.data,
    },
  ]);
}
