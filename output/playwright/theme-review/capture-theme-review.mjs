import { chromium } from 'playwright';

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = 'http://localhost:4300';
const outDir = 'output/playwright/theme-review';
const themeModes = ['light', 'dark'];
const themeColors = ['blue', 'mint', 'amber', 'rose'];

const permissionCodes = [
  'pos_takeaway_menu.view',
  'pos_open_checks.view',
  'pos_payments.create',
  'pos_cash_shift.manage',
  'pos_fiscal_shift.manage',
  'pos_payment_order_items.create',
  'pos_payment_order_items.delete',
];

const menu = [
  {
    id: 'cat-kfc',
    name: 'KFC',
    items: [
      ['i-1', '2TA ACHCHIQ KRANCH', 19000],
      ['i-2', 'BAYTSLAR L', 40000],
      ['i-3', 'BAYTSLAR M', 25000],
      ['i-4', 'CHIKCEN NAGEST x18', 40000],
      ['i-5', 'CHIKCEN NAGEST x6', 17000],
      ['i-6', 'CHIKCEN NAGEST x8', 23000],
      ['i-7', 'KRANCH ASSORTI', 195000],
      ['i-8', 'KRANCH BASKET', 83000],
      ['i-9', 'KRANCH LANCBOX CHIEF BURGER', 55000],
      ['i-10', 'KRANCH LANCH BOXMASTER', 60000],
      ['i-11', 'OSTRIY KRILYA x8', 53000],
      ['i-12', 'OYOQCHA x1', 15000],
    ].map(([id, name, price]) => ({
      id,
      name,
      kind: 'dish',
      prepStationName: 'Oshxona',
      price,
    })),
  },
  { id: 'cat-pizza', name: 'PITSA', items: [] },
  { id: 'cat-hotdog', name: 'XOT DOG', items: [] },
  { id: 'cat-sushi', name: 'ROLL SUSHI', items: [] },
  { id: 'cat-garnish', name: 'GARNERLAR', items: [] },
];

const order = {
  id: 'order-1',
  openedBy: 'user-1',
  openedByName: 'FF Manager',
  orderNumber: 102,
  status: 'open',
  subtotal: 63000,
  serviceFee: 9450,
  serviceFeeEnabled: true,
  serviceFeePercent: 15,
  vatEnabled: true,
  vatPercent: 12,
  vatAmount: 7763,
  total: 72450,
  note: '',
  channel: 'takeaway',
  items: [
    {
      id: 'oi-1',
      catalogItem: 'i-6',
      catalogItemName: 'CHIKCEN NAGEST x8',
      quantity: 1,
      lineTotal: 23000,
      status: 'active',
      prepStationName: 'Oshxona',
    },
    {
      id: 'oi-2',
      catalogItem: 'i-2',
      catalogItemName: 'BAYTSLAR L',
      quantity: 1,
      lineTotal: 40000,
      status: 'active',
      prepStationName: 'Oshxona',
    },
  ],
};

const cashierContext = {
  currentShift: {
    id: 'shift-1',
    cashDesk: 'desk-1',
    cashDeskName: 'Asosiy kassa',
    cashier: 'user-1',
    cashierName: 'FF Manager',
    openingCashAmount: 0,
    expectedClosingCashAmount: 0,
    cashTotal: 0,
    cardTotal: 0,
    qrTotal: 0,
    refundTotal: 0,
  },
  activeShifts: [],
  availableCashDesks: [
    {
      id: 'desk-1',
      name: 'Asosiy kassa',
      enabledPaymentMethods: ['cash', 'card'],
    },
  ],
  availableCashiers: [],
  fiscalShiftOpen: true,
};

const session = {
  token: 'theme-review-token',
  user: {
    id: 'user-1',
    username: 'ff',
    fullName: 'FF Manager',
    permissionCodes,
    restaurantAccessActive: true,
  },
  restaurantAccessActive: true,
  restaurantContext: {
    restaurantId: 'restaurant-1',
    restaurantName: 'Theme Review',
    serviceFeeEnabled: true,
    serviceFeePercent: 15,
    vatEnabled: true,
    vatPercent: 12,
  },
};
const restaurantContext = session.restaurantContext;

function jsonResponse(payload) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  };
}

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 2048, height: 1036 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.route(/\/api\/v1\/pos\//, (route) => {
  if (route.request().method() === 'GET') {
    return route.fulfill(jsonResponse({ data: [] }));
  }
  return route.fulfill(jsonResponse({ ok: true, id: 'mock-id' }));
});
await page.route(/\/api\/v1\/pos\/billing\/context\//, (route) => route.fulfill(jsonResponse(cashierContext)));
await page.route(/\/api\/v1\/pos\/catalog\/menu\//, (route) => route.fulfill(jsonResponse(menu)));
await page.route(/\/api\/v1\/pos\/sales\/orders\/\?status=open/, (route) => route.fulfill(jsonResponse([order])));
await page.route(/\/api\/v1\/pos\/billing\/open-checks\//, (route) => route.fulfill(jsonResponse({ data: [order], count: 1, page: 1, page_size: 25, num_pages: 1 })));

for (const mode of themeModes) {
  for (const color of themeColors) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ session, restaurantContext, mode, color }) => {
        window.localStorage.setItem('restaurant-pos-session', JSON.stringify(session));
        window.localStorage.setItem('restaurant-pos-context', JSON.stringify(restaurantContext));
        window.localStorage.setItem('restaurant-pos-theme-mode', mode);
        window.localStorage.setItem('restaurant-pos-theme-color', color);
        window.localStorage.setItem('restaurant-pos-locale', 'uz');
      },
      { session, restaurantContext, mode, color },
    );
    await page.goto(`${baseUrl}/cashier/builder`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'KFC' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: `${outDir}/${mode}-${color}.png`, fullPage: false });
  }
}

await browser.close();
