import { apiPost } from 'shared/api/client';
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
  restaurant_phone?: string;
  restaurantPhone?: string;
  restaurant_social?: string;
  restaurantSocial?: string;
  tax_number?: string;
  taxNumber?: string;
  order_number?: number | string;
  orderNumber?: number | string;
  order_label?: number | string;
  orderLabel?: number | string;
  receipt_number?: number | string;
  receiptNumber?: number | string;
  channel_label?: string;
  channelLabel?: string;
  table_label?: string | null;
  tableLabel?: string | null;
  delivery_phone?: string;
  deliveryPhone?: string;
  delivery_address?: string;
  deliveryAddress?: string;
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
  service_fee_percent?: number | string;
  serviceFeePercent?: number | string;
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

type PrintReceiptOptions = {
  preferLocalAgent?: boolean;
  receiptId?: string | null;
  printerName?: string | null;
  connectionType?: string | null;
  host?: string | null;
  port?: number | string | null;
};

const RECEIPT_WIDTH = 48;

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

function qrValue(snapshot: PrintablePayload) {
  return String(snapshot.qr_code_url ?? snapshot.qrCodeUrl ?? '').trim();
}

function base64FromBytes(bytes: number[]) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary);
}

function qrRasterBase64(value: string) {
  const text = value.trim();
  if (!text) return '';
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const moduleCount = qr.modules.size;
  const quietModules = 4;
  const scale = 4;
  const pixelSize = (moduleCount + quietModules * 2) * scale;
  const widthBytes = Math.ceil(pixelSize / 8);
  const bytes: number[] = [
    0x0a,
    0x1b,
    0x61,
    0x01,
    0x1d,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    pixelSize & 0xff,
    (pixelSize >> 8) & 0xff,
  ];

  for (let y = 0; y < pixelSize; y += 1) {
    for (let byteIndex = 0; byteIndex < widthBytes; byteIndex += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = byteIndex * 8 + bit;
        const moduleX = Math.floor(x / scale) - quietModules;
        const moduleY = Math.floor(y / scale) - quietModules;
        const isBlack =
          moduleX >= 0 &&
          moduleY >= 0 &&
          moduleX < moduleCount &&
          moduleY < moduleCount &&
          Boolean(qr.modules.get(moduleX, moduleY));
        if (isBlack) byte |= 0x80 >> bit;
      }
      bytes.push(byte);
    }
  }

  bytes.push(0x1b, 0x61, 0x00, 0x0a);
  return base64FromBytes(bytes);
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

function centered(value: string, width = RECEIPT_WIDTH) {
  const text = value.trim();
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return `${' '.repeat(left)}${text}`;
}

function wrapText(value: string, width = RECEIPT_WIDTH) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
    while (current.length > width) {
      lines.push(current.slice(0, width));
      current = current.slice(width);
    }
  }
  if (current) lines.push(current);
  return lines;
}

function prefixedLines(prefix: string, value: string, width = RECEIPT_WIDTH) {
  const cleanValue = value.replace(/\s+/g, ' ').trim();
  if (!cleanValue) return [];
  const words = cleanValue.split(' ');
  const lines: string[] = [];
  let current = prefix;
  for (const word of words) {
    const next = current === prefix ? `${current}${word}` : `${current} ${word}`;
    if (next.length <= width) {
      current = next;
    } else {
      if (current !== prefix) lines.push(current);
      current = word;
    }
    while (current.length > width) {
      lines.push(current.slice(0, width));
      current = current.slice(width);
    }
  }
  if (current && current !== prefix) lines.push(current);
  return lines;
}

function normalizeOrderType(value: unknown) {
  const text = String(value ?? '').trim();
  const lowered = text.toLowerCase();
  if (['dostavka', 'delivery', 'yetkazib berish'].includes(lowered)) return 'Yetkazib berish';
  if (['takeaway', 'olib ketish'].includes(lowered)) return 'Olib ketish';
  if (['hall', 'zal', 'zalda'].includes(lowered)) return 'Zalda';
  return text || 'Zalda';
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
  const receiptNumber = String(payload.receipt_number ?? payload.receiptNumber ?? response?.ReceiptSeq ?? '');
  const orderNumber = String(payload.order_label ?? payload.orderLabel ?? payload.order_number ?? payload.orderNumber ?? receiptNumber);
  const vatAmount = items.reduce((sum, entry) => {
    const item = asRecord(entry) ?? {};
    return sum + fiscalMoney(item.VAT);
  }, 0);
  const firstVatItem = items.map((entry) => asRecord(entry)).find((entry) => Number(entry?.VATPercent || 0) > 0);
  const serviceFee = items.reduce((sum, entry) => {
    const item = asRecord(entry) ?? {};
    const itemName = String(item.Name ?? '')
      .trim()
      .toLowerCase();
    return itemName === 'xizmat haqi' ? sum + fiscalMoney(item.Price) : sum;
  }, 0);

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
    restaurant_phone: String(payload.restaurant_phone ?? payload.restaurantPhone ?? ''),
    restaurant_social: String(payload.restaurant_social ?? payload.restaurantSocial ?? ''),
    tax_number: extraInfo?.TIN ? String(extraInfo.TIN) : String(payload.tax_number ?? payload.taxNumber ?? ''),
    receipt_number: receiptNumber,
    order_number: orderNumber,
    order_label: orderNumber,
    channel_label: String(
      payload.channel_label ??
        payload.channelLabel ??
        (String(receipt.Operation ?? '') === '1' ? 'Qaytarish' : 'Sotuv'),
    ),
    cashier_name: String(payload.cashier_name ?? payload.cashierName ?? ''),
    cashier_id: String(payload.cashier_id ?? payload.cashierId ?? ''),
    waiter_name: String(payload.waiter_name ?? payload.waiterName ?? ''),
    delivery_phone: String(payload.delivery_phone ?? payload.deliveryPhone ?? ''),
    delivery_address: String(payload.delivery_address ?? payload.deliveryAddress ?? ''),
    printed_at_label: String(receipt.Time ?? payload.issued_at ?? payload.issuedAt ?? ''),
    items: items
      .map((entry) => asRecord(entry) ?? {})
      .filter(
        (item) =>
          String(item.Name ?? '')
            .trim()
            .toLowerCase() !== 'xizmat haqi',
      )
      .map((item) => ({
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
      })),
    subtotal: Math.max(total - serviceFee, 0),
    service_fee: serviceFee,
    service_fee_percent: String(payload.service_fee_percent ?? payload.serviceFeePercent ?? ''),
    vat_enabled: vatAmount > 0,
    vat_percent: firstVatItem?.VATPercent ? String(firstVatItem.VATPercent) : '',
    vat_amount: vatAmount,
    total,
    received_cash: fiscalMoney(receivedCash),
    received_card: fiscalMoney(receivedCard),
    terminal_id: String(payload.terminal_id ?? payload.terminalId ?? response?.TerminalID ?? ''),
    factory_id: String(payload.factory_id ?? payload.factoryId ?? ''),
    fiscal_sign: String(payload.fiscal_sign ?? payload.fiscalSign ?? response?.FiscalSign ?? ''),
    qr_code_url: String(payload.qr_code_url ?? payload.qrCodeUrl ?? response?.QRCodeURL ?? ''),
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

function fitLine(left: string, right: string, width = RECEIPT_WIDTH) {
  const cleanLeft = left.replace(/\s+/g, ' ').trim();
  const cleanRight = right.replace(/\s+/g, ' ').trim();
  if (cleanRight.length >= width - cleanLeft.length - 1) {
    return [cleanLeft, ...wrapText(cleanRight, width).map((line) => line.padStart(width))].join('\n');
  }
  const available = Math.max(width - cleanRight.length - 1, 0);
  const visibleLeft = cleanLeft.length > available ? cleanLeft.slice(0, available) : cleanLeft;
  return `${visibleLeft}${' '.repeat(Math.max(width - visibleLeft.length - cleanRight.length, 1))}${cleanRight}`;
}

function itemLine(left: string, quantity: string, right: string, width = RECEIPT_WIDTH) {
  const cleanLeft = left.replace(/\s+/g, ' ').trim();
  const cleanQuantity = quantity.replace(/\s+/g, ' ').trim();
  const cleanRight = right.replace(/\s+/g, ' ').trim();
  const rightStart = Math.max(width - cleanRight.length, 0);
  const leftLimit = Math.max(Math.min(22, rightStart - cleanQuantity.length - 2), 8);
  const visibleLeft = cleanLeft.length > leftLimit ? cleanLeft.slice(0, leftLimit) : cleanLeft;
  const middleStart = Math.min(
    Math.max(24, visibleLeft.length + 1),
    Math.max(rightStart - cleanQuantity.length - 1, visibleLeft.length + 1),
  );
  const chars = Array.from({ length: width }, () => ' ');
  for (let index = 0; index < visibleLeft.length && index < width; index += 1) chars[index] = visibleLeft[index];
  for (let index = 0; index < cleanQuantity.length && middleStart + index < width; index += 1)
    chars[middleStart + index] = cleanQuantity[index];
  for (let index = 0; index < cleanRight.length && rightStart + index < width; index += 1)
    chars[rightStart + index] = cleanRight[index];
  return chars.join('').trimEnd();
}

function receiptDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
  }
  return value;
}

function socialLine(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.includes(':')) return text;
  const lowered = text.toLowerCase();
  if (lowered.includes('instagram') || lowered.startsWith('insta') || lowered.startsWith('@')) return `Instagram: ${text}`;
  if (lowered.includes('telegram') || lowered.startsWith('tg')) return `Telegram: ${text}`;
  return `Social: ${text}`;
}

function receiptTotals(snapshot: PrintablePayload) {
  const serviceFee = numberValue(snapshot.service_fee ?? snapshot.serviceFee);
  const serviceFeePercent = snapshot.service_fee_percent ?? snapshot.serviceFeePercent;
  const total = numberValue(snapshot.total);
  const vatEnabled = Boolean(snapshot.vat_enabled ?? snapshot.vatEnabled);
  const vatPercent = snapshot.vat_percent ?? snapshot.vatPercent;
  const explicitVat = snapshot.vat_amount ?? snapshot.vatAmount;
  const vatAmount = numberValue(explicitVat) || (vatEnabled ? includedVatAmount(total, vatPercent) : 0);

  return {
    serviceFee,
    serviceFeePercent,
    total,
    vatEnabled,
    vatPercent,
    vatAmount,
    receivedCash: numberValue(snapshot.received_cash ?? snapshot.receivedCash),
    receivedCard: numberValue(snapshot.received_card ?? snapshot.receivedCard),
  };
}

function percentLabel(label: string, value: unknown) {
  if (numberValue(value) <= 0) return label;
  const rate = percent(value);
  return rate ? `${label} (${rate}%)` : label;
}

function deliveryDetails(snapshot: PrintablePayload) {
  return {
    phone: String(snapshot.delivery_phone ?? snapshot.deliveryPhone ?? '').trim(),
    address: String(snapshot.delivery_address ?? snapshot.deliveryAddress ?? '').trim(),
  };
}

export function receiptTextFromPayload(payload: Record<string, unknown> | null | undefined) {
  const snapshot = snapshotFromPayload(payload);
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const totals = receiptTotals(snapshot);
  const delivery = deliveryDetails(snapshot);
  const orderNumber =
    snapshot.order_label ??
    snapshot.orderLabel ??
    snapshot.order_number ??
    snapshot.orderNumber ??
    snapshot.receipt_number ??
    snapshot.receiptNumber ??
    '';
  const receiptNumber = snapshot.receipt_number ?? snapshot.receiptNumber;
  const title = String(
    snapshot.restaurant_name ??
      snapshot.restaurantName ??
      snapshot.restaurant_legal_name ??
      snapshot.restaurantLegalName ??
      'Chek',
  );
  const printedAt = snapshot.printed_at_label ?? snapshot.printedAtLabel;
  const { date, time } = dateTimeParts(printedAt);
  const cashierName = snapshot.cashier_name ?? snapshot.cashierName ?? snapshot.waiter_name ?? snapshot.waiterName;
  const restaurantAddress = String(snapshot.restaurant_address ?? snapshot.restaurantAddress ?? '').trim();
  const restaurantPhone = String(snapshot.restaurant_phone ?? snapshot.restaurantPhone ?? '').trim();
  const restaurantSocial = socialLine(snapshot.restaurant_social ?? snapshot.restaurantSocial);
  const orderType = normalizeOrderType(snapshot.channel_label ?? snapshot.channelLabel ?? 'Zalda');
  const orderNumberLabel = String(orderNumber || '-').replace(/^#/, '');
  const lines = [
    centered(title.toUpperCase()),
    '-'.repeat(RECEIPT_WIDTH),
    centered(`Buyurtma raqami: ${orderNumberLabel}`),
    '-'.repeat(RECEIPT_WIDTH),
    ...prefixedLines('Manzil: ', restaurantAddress),
    restaurantPhone ? `Tel: ${restaurantPhone}` : '',
    restaurantSocial,
    '-'.repeat(RECEIPT_WIDTH),
    `Sana: ${receiptDate(date || '-')}`,
    `Buyurtma vaqti: ${time || '-'}`,
    `Buyurtma turi: ${orderType}`,
    '-'.repeat(RECEIPT_WIDTH),
  ].filter(Boolean);

  const tableLabel = snapshot.table_label ?? snapshot.tableLabel;
  if (tableLabel) lines.push(String(tableLabel));
  if (cashierName) lines.push(`Kassir: ${cashierName}`);
  if (delivery.phone) lines.push(`Mijoz tel: ${delivery.phone}`);
  if (delivery.address) lines.push(...prefixedLines('Mijoz manzil: ', delivery.address));
  if (tableLabel || cashierName || delivery.phone || delivery.address) lines.push('-'.repeat(RECEIPT_WIDTH));

  for (const item of items) {
    const quantity = itemQuantityValue(item);
    lines.push(itemLine(String(item.name ?? 'Mahsulot'), `x${quantity}`, money(item.line_total ?? item.lineTotal)));
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
    lines.push('-'.repeat(RECEIPT_WIDTH));
  }

  lines.push('='.repeat(RECEIPT_WIDTH));
  lines.push(fitLine('JAMI:', money(snapshot.total)));
  if (totals.vatEnabled && totals.vatAmount > 0)
    lines.push(fitLine(`${percentLabel('Sh.j. QQS', totals.vatPercent)}:`, moneyFixed(totals.vatAmount)));
  if (totals.serviceFee > 0)
    lines.push(fitLine(`${percentLabel('XIZMAT HAQI', totals.serviceFeePercent)}:`, money(totals.serviceFee)));
  lines.push('='.repeat(RECEIPT_WIDTH));
  if (totals.receivedCash > 0) lines.push(fitLine('NAQD PUL:', money(totals.receivedCash)));
  if (totals.receivedCard > 0) lines.push(fitLine('BANK KARTASI:', money(totals.receivedCard)));

  const terminalId = snapshot.terminal_id ?? snapshot.terminalId;
  const factoryId = snapshot.factory_id ?? snapshot.factoryId;
  const fiscalSign = snapshot.fiscal_sign ?? snapshot.fiscalSign;
  if (terminalId || factoryId || fiscalSign) {
    lines.push('-'.repeat(RECEIPT_WIDTH));
    lines.push(fitLine('STIR:', String(snapshot.tax_number ?? snapshot.taxNumber ?? '-')));
    if (factoryId) lines.push(fitLine('FM:', String(factoryId)));
    if (fiscalSign) lines.push(fitLine('FB:', String(fiscalSign)));
    if (terminalId) lines.push(fitLine('NKM S/R:', String(terminalId)));
  }

  const orderNote = snapshot.order_note ?? snapshot.orderNote;
  if (orderNote) {
    lines.push('-'.repeat(RECEIPT_WIDTH));
    lines.push(String(orderNote));
  }

  lines.push('-'.repeat(RECEIPT_WIDTH));
  lines.push(centered('Buyurtmangiz uchun raxmat!'));
  lines.push(centered('Yoqimli ishtaha!'));
  lines.push('', '');
  return lines.filter((line) => line !== '').join('\n');
}

export async function printReceiptWithLocalAgent(
  payload: Record<string, unknown> | null | undefined,
  options: PrintReceiptOptions = {},
) {
  if (options.preferLocalAgent === false) {
    return false;
  }
  const snapshot = snapshotFromPayload(payload);
  const endpoint = options.receiptId
    ? `/pos/billing/receipts/${options.receiptId}/print/`
    : '/pos/billing/receipts/print/';

  try {
    const qrCode = qrValue(snapshot);
    const data = await apiPost<{ result?: { ok?: boolean } }>(endpoint, {
      payload: payload ?? {},
      text: receiptTextFromPayload(payload),
      qr_code: qrCode,
      qr_raster_base64: qrRasterBase64(qrCode),
    });
    return data.result?.ok === true;
  } catch {
    return false;
  }
}

export async function printReceiptWithFallback(
  payload: Record<string, unknown> | null | undefined,
  options: PrintReceiptOptions = {},
) {
  return printReceiptWithLocalAgent(payload, options);
}
