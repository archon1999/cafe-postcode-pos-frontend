export type PosServiceFeeScope = 'restaurant' | 'hall' | 'table';

export type PosServiceFeeComponent = {
  scope: PosServiceFeeScope;
  sourceName?: string;
  percent: number | string;
  amount?: number | string;
};

export type PosServiceFeeRow = {
  scope: PosServiceFeeScope;
  label: string;
  amount: number;
};

type PosServiceFeeComponentDto = PosServiceFeeComponent & { source_name?: string };

export function normalizeServiceFeeComponents(
  components: PosServiceFeeComponentDto[] | null | undefined,
): PosServiceFeeComponent[] {
  return (components ?? []).map((component) => ({
    ...component,
    sourceName: component.sourceName ?? component.source_name,
  }));
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function buildServiceFeeRows(
  components: PosServiceFeeComponent[] | null | undefined,
  labels: Record<PosServiceFeeScope, string>,
): PosServiceFeeRow[] {
  return (components ?? [])
    .filter((component) => Number(component.percent) > 0 || Number(component.amount) > 0)
    .map((component) => ({
      scope: component.scope,
      label: `${labels[component.scope]} (${formatPercent(Number(component.percent))}%)`,
      amount: Number(component.amount ?? 0),
    }));
}
