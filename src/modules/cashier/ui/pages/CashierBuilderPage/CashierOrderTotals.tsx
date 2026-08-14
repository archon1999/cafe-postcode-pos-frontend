import { Stack, Typography } from '@mui/material';

import type { PosLocale, getPosCopy } from 'shared/locale/copy';
import type { PosServiceFeeRow } from 'shared/pos/service-fees';
import { formatCompactMoney } from 'shared/pos/utils';

type Props = {
  compact?: boolean;
  copy: ReturnType<typeof getPosCopy>;
  locale: PosLocale;
  subtotal: number | string | undefined;
  serviceFee: number | string | undefined;
  serviceFeeLabel: string;
  serviceFeeRows?: PosServiceFeeRow[];
  showServiceFee: boolean;
  vatAmount: number;
  vatLabel: string;
  showVat: boolean;
  total: number | string | undefined;
};

export function CashierOrderTotals({
  compact = false,
  copy,
  locale,
  subtotal,
  serviceFee,
  serviceFeeLabel,
  serviceFeeRows,
  showServiceFee,
  vatAmount,
  vatLabel,
  showVat,
  total,
}: Props) {
  const rowVariant = compact ? 'body2' : 'body1';

  return (
    <>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant={rowVariant} color="text.secondary">
          {copy.subtotal}
          {compact ? '' : ':'}
        </Typography>
        <Typography variant={rowVariant} color={compact ? undefined : 'text.secondary'}>
          {formatCompactMoney(subtotal, locale)}
        </Typography>
      </Stack>
      {serviceFeeRows?.map((row) => (
        <Stack key={row.scope} direction="row" justifyContent="space-between">
          <Typography variant={rowVariant} color="text.secondary">
            {row.label}
            {compact ? '' : ':'}
          </Typography>
          <Typography variant={rowVariant} color={compact ? undefined : 'text.secondary'}>
            {formatCompactMoney(row.amount, locale)}
          </Typography>
        </Stack>
      ))}
      {showServiceFee && !serviceFeeRows?.length ? (
        <Stack direction="row" justifyContent="space-between">
          <Typography variant={rowVariant} color="text.secondary">
            {serviceFeeLabel}
            {compact ? '' : ':'}
          </Typography>
          <Typography variant={rowVariant} color={compact ? undefined : 'text.secondary'}>
            {formatCompactMoney(serviceFee, locale)}
          </Typography>
        </Stack>
      ) : null}
      {showVat ? (
        <Stack direction="row" justifyContent="space-between">
          <Typography variant={rowVariant} color="text.secondary">
            {vatLabel}
            {compact ? '' : ':'}
          </Typography>
          <Typography variant={rowVariant} color={compact ? undefined : 'text.secondary'}>
            {formatCompactMoney(vatAmount, locale)}
          </Typography>
        </Stack>
      ) : null}
      <Stack direction="row" justifyContent="space-between" alignItems={compact ? undefined : 'flex-end'}>
        <Typography variant={compact ? 'body2' : 'h5'} color={compact ? 'text.secondary' : undefined}>
          {copy.grandTotal}
          {compact ? '' : ':'}
        </Typography>
        <Typography variant={compact ? 'h6' : 'h4'} sx={compact ? undefined : { lineHeight: 1.05, textAlign: 'right' }}>
          {formatCompactMoney(total, locale)}
        </Typography>
      </Stack>
    </>
  );
}
