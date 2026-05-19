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

function moneyFixed(value: unknown) {
  return numberValue(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: unknown) {
  const number = numberValue(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '');
}

function itemQuantityValue(item: PrintableItem) {
  const quantity = Number(item.quantity ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function itemUnitPriceValue(item: PrintableItem) {
  const explicit = numberValue(item.unit_price ?? item.unitPrice);
  if (explicit > 0) return explicit;
  return numberValue(item.line_total ?? item.lineTotal) / itemQuantityValue(item);
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
  const normalized = raw
    .replace('T', ' ')
    .replace(/\.\d+.*$/, '')
    .replace(/[+-]\d{2}:?\d{2}$/, '');
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
  const receipt = asRecord(request?.receipt) ?? asRecord(request?.Receipt);
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
    restaurant_name: String(
      payload.restaurant_name ??
        payload.restaurantName ??
        payload.restaurant_legal_name ??
        payload.restaurantLegalName ??
        'Chek',
    ),
    restaurant_legal_name: String(
      payload.restaurant_legal_name ??
        payload.restaurantLegalName ??
        payload.restaurant_name ??
        payload.restaurantName ??
        'Chek',
    ),
    restaurant_address: String(payload.restaurant_address ?? payload.restaurantAddress ?? ''),
    tax_number: extraInfo?.TIN ? String(extraInfo.TIN) : String(payload.tax_number ?? payload.taxNumber ?? ''),
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
        unit_price: fiscalMoney(item.Price) / Number(fiscalQuantity(item.Amount) || 1),
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
  const orderNumber =
    snapshot.order_number ?? snapshot.orderNumber ?? snapshot.receipt_number ?? snapshot.receiptNumber ?? '';
  const receiptNumber = snapshot.receipt_number ?? snapshot.receiptNumber;
  const title = String(
    snapshot.restaurant_legal_name ??
      snapshot.restaurantLegalName ??
      snapshot.restaurant_name ??
      snapshot.restaurantName ??
      'Chek',
  );
  const printedAt = snapshot.printed_at_label ?? snapshot.printedAtLabel;
  const { date, time } = dateTimeParts(printedAt);
  const cashierName = snapshot.cashier_name ?? snapshot.cashierName ?? snapshot.waiter_name ?? snapshot.waiterName;
  const cashierId = snapshot.cashier_id ?? snapshot.cashierId ?? '';
  const lines = [
    centered(title),
    snapshot.restaurant_address || snapshot.restaurantAddress
      ? centered(String(snapshot.restaurant_address ?? snapshot.restaurantAddress))
      : '',
    '',
    fitLine(`CHEK: ${receiptNumber || orderNumber || '-'}`, `${date || '-'} ${time || '-'}`.trim()),
    fitLine('POS: 1', `KASSIR: ${cashierName || '-'}`),
    fitLine(
      `STIR: ${String(snapshot.tax_number ?? snapshot.taxNumber ?? '-')}`,
      `NKM S/R: ${String(snapshot.terminal_id ?? snapshot.terminalId ?? '-')}`,
    ),
    '-'.repeat(42),
  ].filter(Boolean);

  const tableLabel = snapshot.table_label ?? snapshot.tableLabel;
  if (tableLabel)
    lines.push(fitLine(String(tableLabel), String(snapshot.channel_label ?? snapshot.channelLabel ?? 'sotuv')));

  for (const item of items) {
    const quantity = itemQuantityValue(item);
    const unitPrice = itemUnitPriceValue(item);
    lines.push(String(item.name ?? 'Mahsulot').toUpperCase());
    lines.push(fitLine(`${quantity} dona x ${moneyFixed(unitPrice)}`, money(item.line_total ?? item.lineTotal)));
    const itemVatPercent = item.vat_percent ?? item.vatPercent;
    const itemVatAmount = numberValue(item.vat_amount ?? item.vatAmount);
    if (itemVatPercent)
      lines.push(fitLine(`Sh.j. QQS: ${percent(itemVatPercent)}%`, itemVatAmount > 0 ? moneyFixed(itemVatAmount) : ''));
    if (item.spic) lines.push(fitLine('MXIK KOD:', item.spic));
    if (item.barcode) lines.push(fitLine('SH/K:', item.barcode));
    const unitCode = item.unit_code ?? item.unitCode;
    if (unitCode) lines.push(fitLine("O'lchov:", String(unitCode)));
    if (item.labels?.length) lines.push(fitLine('MARKIROVKA:', item.labels.join(', ')));
    if (item.note) lines.push(String(item.note));
    lines.push('-'.repeat(42));
  }

  lines.push('='.repeat(42));
  lines.push(fitLine('JAMI:', money(snapshot.total)));
  if (totals.vatEnabled && totals.vatAmount > 0) lines.push(fitLine('Sh.j. QQS:', moneyFixed(totals.vatAmount)));
  if (totals.serviceFee > 0) lines.push(fitLine('XIZMAT HAQI:', money(totals.serviceFee)));
  lines.push('='.repeat(42));
  if (totals.receivedCash > 0) lines.push(fitLine('NAQD PUL:', money(totals.receivedCash)));
  if (totals.receivedCard > 0) lines.push(fitLine('BANK KARTASI:', money(totals.receivedCard)));

  const terminalId = snapshot.terminal_id ?? snapshot.terminalId;
  const factoryId = snapshot.factory_id ?? snapshot.factoryId;
  const fiscalSign = snapshot.fiscal_sign ?? snapshot.fiscalSign;
  if (terminalId || factoryId || fiscalSign) {
    lines.push('-'.repeat(42));
    if (factoryId) lines.push(`FM: ${factoryId}`);
    if (fiscalSign) lines.push(fitLine('FB:', String(fiscalSign)));
    if (terminalId) lines.push(`NKM S/R: ${terminalId}`);
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
  const orderNumber =
    snapshot.order_number ?? snapshot.orderNumber ?? snapshot.receipt_number ?? snapshot.receiptNumber ?? '';
  const receiptNumber = snapshot.receipt_number ?? snapshot.receiptNumber;
  const title =
    snapshot.restaurant_legal_name ??
    snapshot.restaurantLegalName ??
    snapshot.restaurant_name ??
    snapshot.restaurantName ??
    'Chek';
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
    body { font-family: "Courier New", monospace; color: #111; margin: 0; font-size: 11px; font-weight: 600; }
    .receipt { width: 72mm; }
    h1 { font-size: 12px; margin: 0 0 2px; text-align: center; text-transform: uppercase; }
    .center { text-align: center; }
    .meta, .row, .item, .line { display: flex; justify-content: space-between; gap: 8px; }
    .meta { color: #111; margin: 1px 0; }
    .muted { color: #555; }
    hr { border: 0; border-top: 1px dashed #111; margin: 6px 0; }
    .dash { border-top-style: dashed; }
    .equals { border-top: 2px solid #111; margin: 7px 0; }
    .item-block { margin: 0; }
    .item-name { font-weight: 800; text-transform: uppercase; overflow-wrap: anywhere; }
    .price { min-width: 76px; text-align: right; }
    .grand { font-weight: 900; font-size: 24px; }
    .total { font-weight: 900; font-size: 21px; align-items: baseline; }
    .total span:first-child { font-size: 22px; }
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
    <div class="meta"><span>CHEK: ${escapeHtml(receiptNumber || orderNumber || '-')}</span><span>${escapeHtml(`${date || '-'} ${time || '-'}`.trim())}</span></div>
    <div class="meta"><span>POS: 1</span><span>KASSIR: ${escapeHtml(cashierName || '-')}</span></div>
    <div class="meta"><span>STIR: ${escapeHtml(snapshot.tax_number ?? snapshot.taxNumber ?? '-')}</span><span>NKM S/R: ${escapeHtml(terminalId || '-')}</span></div>
    <hr />
    ${snapshot.table_label || snapshot.tableLabel ? `<div class="meta"><span>${escapeHtml(snapshot.table_label ?? snapshot.tableLabel)}</span><span>${escapeHtml(snapshot.channel_label ?? snapshot.channelLabel ?? 'sotuv')}</span></div>` : ''}
    ${items
      .map((item) => {
        const quantity = itemQuantityValue(item);
        const unitPrice = itemUnitPriceValue(item);
        const itemVatPercent = item.vat_percent ?? item.vatPercent;
        const itemVatAmount = numberValue(item.vat_amount ?? item.vatAmount);
        const unitCode = item.unit_code ?? item.unitCode;
        return `<div class="item-block"><div class="item-name">${escapeHtml(item.name ?? 'Mahsulot')}</div><div class="subrow"><span>${escapeHtml(quantity)} dona x ${moneyFixed(unitPrice)}</span><span class="price">${money(item.line_total ?? item.lineTotal)}</span></div>${
          itemVatPercent
            ? `<div class="subrow"><span>Sh.j. QQS: ${escapeHtml(percent(itemVatPercent))}%</span><span>${itemVatAmount > 0 ? moneyFixed(itemVatAmount) : ''}</span></div>`
            : ''
        }${item.spic ? `<div class="subrow"><span>MXIK KOD:</span><span>${escapeHtml(item.spic)}</span></div>` : ''}${
          item.barcode ? `<div class="subrow"><span>SH/K:</span><span>${escapeHtml(item.barcode)}</span></div>` : ''
        }${unitCode ? `<div class="subrow"><span>O'lchov:</span><span>${escapeHtml(unitCode)}</span></div>` : ''}${
          item.labels?.length
            ? `<div class="subrow"><span>MARKIROVKA:</span><span>${escapeHtml(item.labels.join(', '))}</span></div>`
            : ''
        }${item.note ? `<div class="note">${escapeHtml(item.note)}</div>` : ''}<hr /></div>`;
      })
      .join('')}
    <div class="equals"></div>
    <div class="row total"><span>JAMI:</span><span class="grand">${money(snapshot.total)}</span></div>
    ${totals.vatEnabled && totals.vatAmount > 0 ? `<div class="row"><span>Sh.j. QQS:</span><span>${moneyFixed(totals.vatAmount)}</span></div>` : ''}
    ${totals.serviceFee > 0 ? `<div class="row"><span>XIZMAT HAQI:</span><span>${money(totals.serviceFee)}</span></div>` : ''}
    <div class="equals"></div>
    ${totals.receivedCash > 0 ? `<div class="row"><span>NAQD PUL:</span><span>${money(totals.receivedCash)}</span></div>` : ''}
    ${totals.receivedCard > 0 ? `<div class="row"><span>BANK KARTASI:</span><span>${money(totals.receivedCard)}</span></div>` : ''}
    ${
      terminalId || factoryId || fiscalSign
        ? `<hr />${factoryId ? `<div class="meta"><span>FM:</span><span>${escapeHtml(factoryId)}</span></div>` : ''}${
            fiscalSign ? `<div class="meta"><span>FB:</span><span>${escapeHtml(fiscalSign)}</span></div>` : ''
          }${terminalId ? `<div class="meta"><span>NKM S/R:</span><span>${escapeHtml(terminalId)}</span></div>` : ''}`
        : ''
    }
    ${
      qrCodeUrl
        ? `<hr /><div class="center">${qrImage ? `<img src="${escapeHtml(qrImage)}" alt="Soliq QR Code" style="width:34mm;height:34mm;" />` : ''}</div>`
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
