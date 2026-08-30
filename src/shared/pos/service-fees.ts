export type PosServiceFeeScope = 'restaurant' | 'hall' | 'table';
export type PosServiceFeeMode = 'percentage' | 'hourly';

export type PosServiceFeeComponent = {
  scope: PosServiceFeeScope;
  sourceName?: string;
  mode?: PosServiceFeeMode;
  percent?: number | string;
  hourlyRate?: number | string;
  durationMinutes?: number;
  amount?: number | string;
};

export type PosServiceFeeQuote = {
  quotedAt?: string;
  billableMinutes: number;
  serviceFee: number;
  calculatedTotal: number;
};

export type PosServiceFeeRow = {
  scope: PosServiceFeeScope;
  label: string;
  amount: number;
};

type PosServiceFeeComponentDto = PosServiceFeeComponent & {
  source_name?: string;
  hourly_rate?: number | string;
  duration_minutes?: number;
};

export function normalizeServiceFeeComponents(
  components: PosServiceFeeComponentDto[] | null | undefined,
): PosServiceFeeComponent[] | undefined {
  if (components === null || components === undefined) return undefined;

  return components.map((component) => ({
    ...component,
    sourceName: component.sourceName ?? component.source_name,
    mode: component.mode ?? 'percentage',
    hourlyRate: component.hourlyRate ?? component.hourly_rate,
    durationMinutes: component.durationMinutes ?? component.duration_minutes,
  }));
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(value);
}

export function calculateBillableMinutes(startedAt?: string | null, endedAt?: string | null, now = Date.now()) {
  if (!startedAt) return 0;
  const started = Date.parse(startedAt);
  const ended = endedAt ? Date.parse(endedAt) : now;
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return 0;
  return Math.ceil(Math.max(ended - started, 0) / 60_000);
}

export function calculateServiceFeeComponents(
  components: PosServiceFeeComponent[] | null | undefined,
  options: { subtotal: number; startedAt?: string | null; frozenAt?: string | null; now?: number },
) {
  const durationMinutes = calculateBillableMinutes(options.startedAt, options.frozenAt, options.now ?? Date.now());
  return (components ?? [])
    .filter((component) =>
      (component.mode ?? 'percentage') === 'hourly'
        ? Number(component.hourlyRate ?? 0) > 0
        : Number(component.percent ?? 0) > 0,
    )
    .map((component) => {
      if ((component.mode ?? 'percentage') === 'hourly') {
        const minutes = options.startedAt ? durationMinutes : Number(component.durationMinutes ?? 0);
        return {
          ...component,
          mode: 'hourly' as const,
          durationMinutes: minutes,
          amount: Math.round((Number(component.hourlyRate ?? 0) * minutes) / 60),
        };
      }
      return {
        ...component,
        mode: 'percentage' as const,
        percent: Number(component.percent ?? 0),
        amount: Math.round((options.subtotal * Number(component.percent ?? 0)) / 100),
      };
    });
}

export function buildServiceFeeRows(
  components: PosServiceFeeComponent[] | null | undefined,
  labels: Record<PosServiceFeeScope, string>,
): PosServiceFeeRow[] {
  return (components ?? [])
    .filter((component) => Number(component.percent ?? 0) > 0 || Number(component.amount) > 0)
    .map((component) => ({
      scope: component.scope,
      label:
        (component.mode ?? 'percentage') === 'hourly'
          ? `${labels[component.scope]} (${formatMoney(Number(component.hourlyRate ?? 0))} UZS/soat × ${Number(component.durationMinutes ?? 0)} daq.)`
          : `${labels[component.scope]} (${formatPercent(Number(component.percent ?? 0))}%)`,
      amount: Number(component.amount ?? 0),
    }));
}
