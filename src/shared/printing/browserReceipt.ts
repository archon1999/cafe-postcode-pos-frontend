import QRCode from 'qrcode';

type PrintableItem = {
  name?: string;
  quantity?: number | string;
  line_total?: number | string;
  lineTotal?: number | string;
  unit_price?: number | string;
  unitPrice?: number | string;
  vat_percent?: number | string;
  vatPercent?: number | string;
  vat_amount?: number | string;
  vatAmount?: number | string;
  spic?: string;
  barcode?: string;
  unit_code?: number | string;
  unitCode?: number | string;
  labels?: string[];
  note?: string;
};

type PrintablePayload = {
  restaurant_name?: string;
  restaurantName?: string;
  restaurant_legal_name?: string;
  restaurantLegalName?: string;
  restaurant_address?: string;
  restaurantAddress?: string;
  tax_number?: string;
  taxNumber?: string;
  order_number?: number | string;
  orderNumber?: number | string;
  receipt_number?: number | string;
  receiptNumber?: number | string;
  channel_label?: string;
  channelLabel?: string;
  table_label?: string | null;
  tableLabel?: string | null;
  waiter_name?: string;
  waiterName?: string;
  cashier_name?: string;
  cashierName?: string;
  cashier_id?: string;
  cashierId?: string;
  z_report_number?: number | string;
  zReportNumber?: number | string;
  printed_at_label?: string;
  printedAtLabel?: string;
  items?: PrintableItem[];
  subtotal?: number | string;
  service_fee?: number | string;
  serviceFee?: number | string;
  vat_enabled?: boolean;
  vatEnabled?: boolean;
  vat_percent?: number | string;
  vatPercent?: number | string;
  vat_amount?: number | string;
  vatAmount?: number | string;
  total?: number | string;
  received_cash?: number | string;
  receivedCash?: number | string;
  received_card?: number | string;
  receivedCard?: number | string;
  terminal_id?: string;
  terminalId?: string;
  factory_id?: string;
  factoryId?: string;
  fiscal_sign?: string;
  fiscalSign?: string;
  qr_code_url?: string;
  qrCodeUrl?: string;
  order_note?: string;
  orderNote?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function fiscalMoney(value: unknown) {
  return Math.round(Number(value || 0) / 100);
}

function fiscalQuantity(value: unknown) {
  const quantity = Number(value || 0) / 1000;
  return Number.isInteger(quantity) ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '');
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function qrValue(snapshot: PrintablePayload) {
  return String(snapshot.qr_code_url ?? snapshot.qrCodeUrl ?? '').trim();
}

async function qrDataUrl(value: string) {
  if (!value) return '';
  try {
    return await QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch {
    return '';
  }
}

function money(value: unknown) {
  return numberValue(value).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function percent(value: unknown) {
  const number = numberValue(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '');
}

function includedVatAmount(total: unknown, vatPercent: unknown) {
  const amount = numberValue(total);
  const rate = numberValue(vatPercent);
  if (amount <= 0 || rate <= 0) return 0;
  return Math.round((amount * rate) / (100 + rate));
}

function dateTimeParts(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return { date: '', time: '' };
  const normalized = raw.replace('T', ' ').replace(/\.\d+.*$/, '').replace(/[+-]\d{2}:?\d{2}$/, '');
  const [date = '', time = ''] = normalized.split(/\s+/, 2);
  return { date, time: time.slice(0, 8) };
}

function centered(value: string, width = 42) {
  const text = value.trim();
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return `${' '.repeat(left)}${text}`;
}

function fiscalSnapshotFromPayload(payload: Record<string, unknown>): PrintablePayload | null {
  const request = asRecord(payload.request);
  const receipt = asRecord(request?.receipt);
  if (!receipt) return null;

  const response = asRecord(payload.response);
  const extraInfo = asRecord(receipt.ExtraInfo);
  const items = Array.isArray(receipt.Items) ? receipt.Items : [];
  const receivedCash = Number(receipt.ReceivedCash || 0);
  const receivedCard = Number(receipt.ReceivedCard || 0);
  const total = fiscalMoney(receivedCash + receivedCard);
  const receiptNumber = payload.receipt_number ?? payload.receiptNumber ?? response?.ReceiptSeq ?? '';
  const vatAmount = items.reduce((sum, entry) => {
    const item = asRecord(entry) ?? {};
    return sum + fiscalMoney(item.VAT);
  }, 0);
  const firstVatItem = items.map((entry) => asRecord(entry)).find((entry) => Number(entry?.VATPercent || 0) > 0);

  return {
    restaurant_name: String(payload.restaurant_name ?? payload.restaurantName ?? payload.restaurant_legal_name ?? payload.restaurantLegalName ?? 'Chek'),
    restaurant_legal_name: String(payload.restaurant_legal_name ?? payload.restaurantLegalName ?? payload.restaurant_name ?? payload.restaurantName ?? 'Chek'),
    restaurant_address: String(payload.restaurant_address ?? payload.restaurantAddress ?? ''),
    tax_number: extraInfo?.TIN ? String(extraInfo.TIN) : '',
    receipt_number: receiptNumber,
    order_number: receiptNumber,
    channel_label: String(receipt.Operation ?? '') === '1' ? 'Qaytarish' : 'Sotuv',
    printed_at_label: String(receipt.Time ?? payload.issued_at ?? payload.issuedAt ?? ''),
    items: items.map((entry) => {
      const item = asRecord(entry) ?? {};
      return {
        name: String(item.Name ?? 'Mahsulot'),
        quantity: fiscalQuantity(item.Amount),
        line_total: fiscalMoney(item.Price),
        vat_percent: item.VATPercent ? String(item.VATPercent) : '',
        vat_amount: item.VAT ? fiscalMoney(item.VAT) : 0,
        spic: item.SPIC ? String(item.SPIC) : '',
        barcode: item.Barcode ? String(item.Barcode) : '',
        unit_code: item.Units ? String(item.Units) : '',
        labels: Array.isArray(item.Labels) ? item.Labels.map(String) : [],
      };
    }),
    subtotal: total,
    service_fee: 0,
    vat_enabled: vatAmount > 0,
    vat_percent: firstVatItem?.VATPercent ? String(firstVatItem.VATPercent) : '',
    vat_amount: vatAmount,
    total,
    received_cash: fiscalMoney(receivedCash),
    received_card: fiscalMoney(receivedCard),
    terminal_id: response?.TerminalID ? String(response.TerminalID) : '',
    factory_id: payload.factory_id ? String(payload.factory_id) : '',
    fiscal_sign: response?.FiscalSign ? String(response.FiscalSign) : '',
    qr_code_url: response?.QRCodeURL ? String(response.QRCodeURL) : '',
  };
}

function snapshotFromPayload(payload: Record<string, unknown> | null | undefined): PrintablePayload {
  const snapshot = asRecord(payload?.snapshot);
  if (snapshot) return snapshot as PrintablePayload;
  if (payload) {
    const fiscalSnapshot = fiscalSnapshotFromPayload(payload);
    if (fiscalSnapshot) return fiscalSnapshot;
  }
  return (payload as PrintablePayload | null | undefined) ?? {};
}

function fitLine(left: string, right: string, width = 42) {
  const cleanLeft = left.replace(/\s+/g, ' ').trim();
  const cleanRight = right.replace(/\s+/g, ' ').trim();
  const available = Math.max(width - cleanRight.length - 1, 0);
  const visibleLeft = cleanLeft.length > available ? cleanLeft.slice(0, available) : cleanLeft;
  return `${visibleLeft}${' '.repeat(Math.max(width - visibleLeft.length - cleanRight.length, 1))}${cleanRight}`;
}

function receiptTotals(snapshot: PrintablePayload) {
  const serviceFee = numberValue(snapshot.service_fee ?? snapshot.serviceFee);
  const total = numberValue(snapshot.total);
  const vatEnabled = Boolean(snapshot.vat_enabled ?? snapshot.vatEnabled);
  const vatPercent = snapshot.vat_percent ?? snapshot.vatPercent;
  const explicitVat = snapshot.vat_amount ?? snapshot.vatAmount;
  const vatAmount = numberValue(explicitVat) || (vatEnabled ? includedVatAmount(total, vatPercent) : 0);

  return {
    serviceFee,
    total,
    vatEnabled,
    vatPercent,
    vatAmount,
    receivedCash: numberValue(snapshot.received_cash ?? snapshot.receivedCash),
    receivedCard: numberValue(snapshot.received_card ?? snapshot.receivedCard),
  };
}

function receiptTextFromPayload(payload: Record<string, unknown> | null | undefined) {
  const snapshot = snapshotFromPayload(payload);
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const totals = receiptTotals(snapshot);
  const orderNumber = snapshot.order_number ?? snapshot.orderNumber ?? snapshot.receipt_number ?? snapshot.receiptNumber ?? '';
  const receiptNumber = snapshot.receipt_number ?? snapshot.receiptNumber;
  const title = String(snapshot.restaurant_legal_name ?? snapshot.restaurantLegalName ?? snapshot.restaurant_name ?? snapshot.restaurantName ?? 'Chek');
  const printedAt = snapshot.printed_at_label ?? snapshot.printedAtLabel;
  const { date, time } = dateTimeParts(printedAt);
  const cashierName = snapshot.cashier_name ?? snapshot.cashierName ?? snapshot.waiter_name ?? snapshot.waiterName;
  const cashierId = snapshot.cashier_id ?? snapshot.cashierId ?? '';
  const lines = [
    title,
    snapshot.restaurant_address || snapshot.restaurantAddress ? String(snapshot.restaurant_address ?? snapshot.restaurantAddress) : '',
    '-'.repeat(42),
    fitLine('STIR', String(snapshot.tax_number ?? snapshot.taxNumber ?? '-')),
    fitLine('Sana', date || '-'),
    fitLine('Vaqt', time || '-'),
    fitLine('Chek', String(receiptNumber || orderNumber || '-')),
    fitLine('Z-hisobot NO', String(snapshot.z_report_number ?? snapshot.zReportNumber ?? '-')),
    fitLine('Kassir ismi', String(cashierName || '-')),
    fitLine('Kassir ID', String(cashierId || '-')),
    '-'.repeat(42),
    centered(String(snapshot.channel_label ?? snapshot.channelLabel ?? 'sotuv').toLowerCase()),
  ].filter(Boolean);

  const tableLabel = snapshot.table_label ?? snapshot.tableLabel;
  if (tableLabel) lines.push(String(tableLabel));
  lines.push('-'.repeat(42));

  for (const item of items) {
    lines.push(String(item.name ?? 'Mahsulot'));
    lines.push(fitLine(`  ${item.quantity ?? 1}`, money(item.line_total ?? item.lineTotal)));
    const itemVatPercent = item.vat_percent ?? item.vatPercent;
    const itemVatAmount = numberValue(item.vat_amount ?? item.vatAmount);
    if (itemVatPercent && itemVatAmount > 0) {
      lines.push(fitLine(`  QQS (${percent(itemVatPercent)}%)`, money(itemVatAmount)));
    }
    if (item.barcode) lines.push(`  Shtrix-kod: ${item.barcode}`);
    if (item.spic) lines.push(`  MXIK kodi: ${item.spic}`);
    const unitCode = item.unit_code ?? item.unitCode;
    if (unitCode) lines.push(`  O'lchov birligi: ${unitCode}`);
    if (item.labels?.length) lines.push(`  Markirovka kodi: ${item.labels.join(', ')}`);
    if (item.note) lines.push(`  ${item.note}`);
  }

  lines.push('-'.repeat(42));
  lines.push(fitLine('Chegirma', money(0)));
  lines.push(fitLine('Jami', money(snapshot.total)));
  if (totals.serviceFee > 0) lines.push(fitLine('Xizmat haqi', money(totals.serviceFee)));
  if (totals.vatEnabled && totals.vatAmount > 0) lines.push(fitLine('Umumiy QQS', money(totals.vatAmount)));
  lines.push('-'.repeat(42));
  lines.push(fitLine('Naqd pul', money(totals.receivedCash)));
  lines.push(fitLine('Bank kartalari', money(totals.receivedCard)));
  lines.push('-'.repeat(42));
  lines.push(fitLine('Jami olindi', money(snapshot.total)));

  const terminalId = snapshot.terminal_id ?? snapshot.terminalId;
  const factoryId = snapshot.factory_id ?? snapshot.factoryId;
  const fiscalSign = snapshot.fiscal_sign ?? snapshot.fiscalSign;
  if (terminalId || factoryId || fiscalSign) {
    lines.push('-'.repeat(42));
    if (terminalId) lines.push(`Terminal S/N: ${terminalId}`);
    if (factoryId) lines.push(`FM ID: ${factoryId}`);
    if (fiscalSign) lines.push(`Fiskal imzo: ${fiscalSign}`);
  }

  const qrCodeUrl = snapshot.qr_code_url ?? snapshot.qrCodeUrl;
  if (qrCodeUrl) lines.push(`QR: ${qrCodeUrl}`);

  const orderNote = snapshot.order_note ?? snapshot.orderNote;
  if (orderNote) {
    lines.push('-'.repeat(42));
    lines.push(String(orderNote));
  }

  lines.push('', '');
  return lines.filter((line) => line !== '').join('\n');
}

export async function printReceiptWithLocalAgent(payload: Record<string, unknown> | null | undefined) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2500);
  const snapshot = snapshotFromPayload(payload);

  try {
    const response = await fetch('http://127.0.0.1:18181/print/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: receiptTextFromPayload(payload),
        qr_code: qrValue(snapshot),
        cut_after_print: true,
        job_name: 'Cafe Postcode Receipt',
      }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const data = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return data?.ok === true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function printReceiptWithFallback(payload: Record<string, unknown> | null | undefined) {
  const printed = await printReceiptWithLocalAgent(payload);
  if (!printed) {
    await printReceiptInBrowser(payload);
  }
  return printed;
}

export async function printReceiptInBrowser(payload: Record<string, unknown> | null | undefined) {
  const snapshot = snapshotFromPayload(payload);
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const totals = receiptTotals(snapshot);
  const orderNumber = snapshot.order_number ?? snapshot.orderNumber ?? snapshot.receipt_number ?? snapshot.receiptNumber ?? '';
  const receiptNumber = snapshot.receipt_number ?? snapshot.receiptNumber;
  const title = snapshot.restaurant_legal_name ?? snapshot.restaurantLegalName ?? snapshot.restaurant_name ?? snapshot.restaurantName ?? 'Chek';
  const printedAt = snapshot.printed_at_label ?? snapshot.printedAtLabel;
  const { date, time } = dateTimeParts(printedAt);
  const cashierName = snapshot.cashier_name ?? snapshot.cashierName ?? snapshot.waiter_name ?? snapshot.waiterName;
  const cashierId = snapshot.cashier_id ?? snapshot.cashierId ?? '';
  const terminalId = snapshot.terminal_id ?? snapshot.terminalId;
  const factoryId = snapshot.factory_id ?? snapshot.factoryId;
  const fiscalSign = snapshot.fiscal_sign ?? snapshot.fiscalSign;
  const qrCodeUrl = qrValue(snapshot);
  const qrImage = await qrDataUrl(qrCodeUrl);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Chek</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #111; margin: 0; font-size: 11px; }
    .receipt { width: 72mm; }
    h1 { font-size: 13px; margin: 0 0 2px; text-align: center; }
    .center { text-align: center; }
    .meta, .row, .item, .line { display: flex; justify-content: space-between; gap: 8px; }
    .meta { color: #111; margin: 1px 0; }
    .muted { color: #555; }
    hr { border: 0; border-top: 1px solid #777; margin: 6px 0; }
    .dash { border-top-style: dashed; }
    .operation { font-size: 16px; font-weight: 700; text-align: center; margin: 4px 0; text-transform: lowercase; }
    .item-head { display: grid; grid-template-columns: 1fr 38px 78px; gap: 6px; font-weight: 700; text-align: right; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    .item-head span:first-child { text-align: center; }
    .item { margin: 5px 0 2px; align-items: flex-start; }
    .name { flex: 1; overflow-wrap: anywhere; }
    .price { min-width: 78px; text-align: right; }
    .qty { min-width: 38px; text-align: right; }
    .grand { font-weight: 700; font-size: 21px; }
    .total { font-weight: 700; font-size: 13px; }
    .note, .subline { color: #222; margin: 1px 0; overflow-wrap: anywhere; }
    .subrow { display: flex; justify-content: space-between; gap: 8px; margin: 1px 0; }
    .label { color: #222; }
    .value { text-align: right; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <section class="receipt">
    <h1>${escapeHtml(title)}</h1>
    ${snapshot.restaurant_address || snapshot.restaurantAddress ? `<div class="center muted">${escapeHtml(snapshot.restaurant_address ?? snapshot.restaurantAddress)}</div>` : ''}
    <hr />
    <div class="meta"><span>STIR</span><span>${escapeHtml(snapshot.tax_number ?? snapshot.taxNumber ?? '-')}</span></div>
    <div class="meta"><span>Sana</span><span>${escapeHtml(date || '-')}</span></div>
    <div class="meta"><span>Vaqt</span><span>${escapeHtml(time || '-')}</span></div>
    <div class="meta"><span>Chek</span><span>${escapeHtml(receiptNumber || orderNumber || '-')}</span></div>
    <div class="meta"><span>Z-hisobot NO</span><span>${escapeHtml(snapshot.z_report_number ?? snapshot.zReportNumber ?? '-')}</span></div>
    <div class="meta"><span>Kassir ismi</span><span>${escapeHtml(cashierName || '-')}</span></div>
    <div class="meta"><span>Kassir ID</span><span>${escapeHtml(cashierId || '-')}</span></div>
    <hr />
    <div class="operation">${escapeHtml(snapshot.channel_label ?? snapshot.channelLabel ?? 'sotuv')}</div>
    ${snapshot.table_label || snapshot.tableLabel ? `<div class="meta"><span>${escapeHtml(snapshot.table_label ?? snapshot.tableLabel)}</span><span></span></div>` : ''}
    <div class="item-head"><span>Nomi</span><span>Soni</span><span>Narxi</span></div>
    ${items
      .map((item) => {
        const itemVatPercent = item.vat_percent ?? item.vatPercent;
        const itemVatAmount = numberValue(item.vat_amount ?? item.vatAmount);
        const unitCode = item.unit_code ?? item.unitCode;
        return `<div class="item"><span class="name">${escapeHtml(item.name)}</span><span class="qty">${escapeHtml(item.quantity ?? 1)}</span><span class="price">${money(item.line_total ?? item.lineTotal)}</span></div>${
          itemVatAmount > 0 ? `<div class="subrow"><span class="label">QQS qiymati</span><span class="value">${money(itemVatAmount)}</span></div>` : ''
        }${itemVatPercent ? `<div class="subrow"><span class="label">QQS foizi</span><span class="value">${escapeHtml(percent(itemVatPercent))} %</span></div>` : ''}<div class="subrow"><span class="label">Chegirma/Boshqa</span><span class="value">0/0</span></div>${
          item.barcode ? `<div class="subrow"><span class="label">Shtrix kodi</span><span class="value">${escapeHtml(item.barcode)}</span></div>` : '<div class="subrow"><span class="label">Shtrix kodi</span><span class="value"></span></div>'
        }${item.spic ? `<div class="subrow"><span class="label">MXIK kodi</span><span class="value">${escapeHtml(item.spic)}</span></div>` : '<div class="subrow"><span class="label">MXIK kodi</span><span class="value"></span></div>'}${
          unitCode ? `<div class="subrow"><span class="label">O'lchov birligi</span><span class="value">${escapeHtml(unitCode)}</span></div>` : `<div class="subrow"><span class="label">O'lchov birligi</span><span class="value"></span></div>`
        }<div class="subrow"><span class="label">Markirovka kodi</span><span class="value">${escapeHtml(item.labels?.join(', ') ?? '')}</span></div>${item.note ? `<div class="note">${escapeHtml(item.note)}</div>` : ''}`;
      })
      .join('')}
    <hr class="dash" />
    <div class="row"><span>Chegirma</span><span>0</span></div>
    <div class="row"><span>Jami</span><span>${money(snapshot.total)}</span></div>
    ${totals.serviceFee > 0 ? `<div class="row"><span>Xizmat haqi</span><span>${money(totals.serviceFee)}</span></div>` : ''}
    ${totals.vatEnabled && totals.vatAmount > 0 ? `<div class="row"><span>Umumiy QQS</span><span>${money(totals.vatAmount)}</span></div>` : ''}
    <hr />
    <div class="row"><span>Naqd pul</span><span>${money(totals.receivedCash)}</span></div>
    <div class="row"><span>Bank kartalari</span><span>${money(totals.receivedCard)}</span></div>
    <hr />
    <div class="row total"><span>Jami to'lov:</span><span class="grand">${money(snapshot.total)}</span></div>
    ${
      terminalId || factoryId || fiscalSign
        ? `<hr />${terminalId ? `<div class="meta"><span>Terminal S/N</span><span>${escapeHtml(terminalId)}</span></div>` : ''}${
            factoryId ? `<div class="meta"><span>FM ID</span><span>${escapeHtml(factoryId)}</span></div>` : ''
          }${fiscalSign ? `<div class="meta"><span>Fiskal imzo</span><span>${escapeHtml(fiscalSign)}</span></div>` : ''}`
        : ''
    }
    ${
      qrCodeUrl
        ? `<hr /><div class="center">${qrImage ? `<img src="${escapeHtml(qrImage)}" alt="Soliq QR Code" style="width:34mm;height:34mm;" />` : ''}<div class="subline">Soliq QR Code</div></div>`
        : ''
    }
    ${snapshot.order_note || snapshot.orderNote ? `<hr /><div>${escapeHtml(snapshot.order_note ?? snapshot.orderNote)}</div>` : ''}
  </section>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => frame.remove(), 30000);
}
