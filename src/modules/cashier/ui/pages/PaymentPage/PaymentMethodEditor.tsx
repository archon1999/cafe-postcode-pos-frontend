import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { useState } from 'react';

import type { PaymentMethod } from 'modules/cashier/domain';
import { getPosCopy, type PosLocale } from 'shared/locale/copy';
import { formatCompactMoney } from 'shared/pos/utils';

import type { SplitPaymentPart } from './usePaymentEditorState';

type PaymentMethodEditorProps = {
  addPaymentPartLabel: string;
  amount: string;
  copy: ReturnType<typeof getPosCopy>;
  hasZeroSplitAmount: boolean;
  isPaymentAmountValid: boolean;
  isSplitPaymentValid: boolean;
  locale: PosLocale;
  method: PaymentMethod;
  onAmountChange: (amount: string) => void;
  onCreateSplit: () => void;
  onMethodChange: (method: PaymentMethod) => void;
  onRemoveSplitPart: (id: string) => void;
  onUpdateSplitPart: (id: string, changes: Partial<SplitPaymentPart>) => void;
  paymentOptions: Array<{ value: PaymentMethod; label: string }>;
  splitParts: SplitPaymentPart[] | null;
  splitPaymentTitle: string;
  splitTotal: number;
  splitValidationMessage: string;
  calculatedTotal: number;
  discountAmount: number;
  discountPercent: string;
  discountPercentValid: boolean;
  totalEditable: boolean;
  totalEditMode: 'amount' | 'percentage';
  onDiscountPercentChange: (value: string) => void;
  onTotalEditModeChange: (mode: 'amount' | 'percentage') => void;
};

export function PaymentMethodEditor({
  addPaymentPartLabel,
  amount,
  copy,
  hasZeroSplitAmount,
  isPaymentAmountValid,
  isSplitPaymentValid,
  locale,
  method,
  onAmountChange,
  onCreateSplit,
  onMethodChange,
  onRemoveSplitPart,
  onUpdateSplitPart,
  paymentOptions,
  splitParts,
  splitPaymentTitle,
  splitTotal,
  splitValidationMessage,
  calculatedTotal,
  discountAmount,
  discountPercent,
  discountPercentValid,
  totalEditable,
  totalEditMode,
  onDiscountPercentChange,
  onTotalEditModeChange,
}: PaymentMethodEditorProps) {
  const [totalAdjustmentExpanded, setTotalAdjustmentExpanded] = useState(false);
  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="h5">{copy.paymentMethod}</Typography>
      </Stack>

      {!splitParts ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
          {paymentOptions.map((option) => (
            <Button
              key={option.value}
              variant="contained"
              onClick={() => onMethodChange(option.value)}
              sx={(theme) => ({
                flex: 1,
                minWidth: { xs: '100%', sm: 120 },
                backgroundImage: 'none',
                backgroundColor: method === option.value ? theme.palette.primary.main : 'var(--pos-payment-option-bg)',
                color: method === option.value ? '#ffffff' : 'text.primary',
              })}>
              {option.label}
            </Button>
          ))}
        </Stack>
      ) : null}

      {totalEditable && totalAdjustmentExpanded ? (
        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            variant={totalEditMode === 'amount' ? 'contained' : 'outlined'}
            aria-pressed={totalEditMode === 'amount'}
            onClick={() => onTotalEditModeChange('amount')}>
            {copy.totalAdjustmentAmount}
          </Button>
          <Button
            fullWidth
            variant={totalEditMode === 'percentage' ? 'contained' : 'outlined'}
            aria-pressed={totalEditMode === 'percentage'}
            onClick={() => onTotalEditModeChange('percentage')}>
            {copy.totalAdjustmentPercent}
          </Button>
        </Stack>
      ) : null}

      <Stack direction="row" spacing={1} alignItems="flex-start">
        {totalEditable && totalEditMode === 'percentage' ? (
          <TextField
            label={copy.discountPercent}
            value={discountPercent}
            type="number"
            slotProps={{
              htmlInput: { min: 0, max: 99.99, step: 0.01 },
              input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
            }}
            onChange={(event) => onDiscountPercentChange(event.target.value)}
            error={!discountPercentValid}
            helperText={!discountPercentValid ? copy.discountPercentInvalid : ' '}
            fullWidth
          />
        ) : (
          <Tooltip title={!isPaymentAmountValid ? copy.zeroAmountNotAllowed : ''} arrow>
            <TextField
              label={totalEditable ? copy.finalPaymentTotal : copy.total}
              value={amount}
              type="number"
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              onChange={(event) => onAmountChange(event.target.value)}
              onClick={() => setTotalAdjustmentExpanded(true)}
              onFocus={() => setTotalAdjustmentExpanded(true)}
              error={!isPaymentAmountValid}
              fullWidth
            />
          </Tooltip>
        )}
        <Tooltip title={addPaymentPartLabel} arrow>
          <IconButton
            aria-label={addPaymentPartLabel}
            onClick={onCreateSplit}
            sx={(theme) => ({
              width: 56,
              height: 56,
              borderRadius: '8px',
              backgroundColor: 'var(--pos-payment-option-bg)',
              color: theme.palette.primary.main,
              '&:hover': { backgroundColor: 'var(--pos-payment-option-hover-bg)' },
            })}>
            <Icon icon="solar:add-circle-bold" width={25} />
          </IconButton>
        </Tooltip>
      </Stack>

      {totalEditable && totalAdjustmentExpanded ? (
        <Box
          sx={(theme) => ({
            borderRadius: '10px',
            p: 1.4,
            bgcolor: alpha(theme.palette.text.primary, 0.045),
          })}>
          <Stack spacing={1.2}>
            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Typography color="text.secondary">{copy.calculatedTotal}</Typography>
              <Typography fontWeight={800}>{formatCompactMoney(calculatedTotal, locale)}</Typography>
            </Stack>
            {totalEditMode === 'percentage' ? (
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography color="text.secondary">{copy.discountAmount}</Typography>
                <Typography fontWeight={800} color="success.main">
                  − {formatCompactMoney(discountAmount, locale)}
                </Typography>
              </Stack>
            ) : null}
            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Typography color="text.secondary">{copy.finalPaymentTotal}</Typography>
              <Typography fontWeight={900}>{formatCompactMoney(Number(amount || 0), locale)}</Typography>
            </Stack>
          </Stack>
        </Box>
      ) : null}

      {splitParts ? (
        <Stack
          spacing={1.1}
          sx={(theme) => {
            const hasSplitTotalMismatch = !hasZeroSplitAmount && !isSplitPaymentValid;
            return {
              borderRadius: '10px',
              border: `1px solid ${alpha(
                hasSplitTotalMismatch ? theme.palette.error.main : theme.palette.text.primary,
                hasSplitTotalMismatch ? 0.45 : 0.12,
              )}`,
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? alpha('#ffffff', 0.02)
                  : alpha(hasSplitTotalMismatch ? theme.palette.error.main : '#ffffff', 0.45),
              p: 1.2,
            };
          }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="body1" sx={{ fontWeight: 800 }}>
              {splitPaymentTitle}
            </Typography>
            <Typography
              variant="body2"
              color={!hasZeroSplitAmount && !isSplitPaymentValid ? 'error' : 'text.secondary'}>
              {formatCompactMoney(splitTotal, locale)}
            </Typography>
          </Stack>
          {splitParts.map((part, index) => {
            const isPartPaid = part.status === 'paid';
            const partHasZeroAmount = !isPartPaid && Number(part.amount || 0) <= 0;
            const partHasError = !isPartPaid && (partHasZeroAmount || (!hasZeroSplitAmount && !isSplitPaymentValid));
            const validationMessage = partHasZeroAmount
              ? copy.zeroAmountNotAllowed
              : !isPartPaid && !isSplitPaymentValid
                ? splitValidationMessage
                : '';

            return (
              <Stack key={part.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                <TextField
                  select
                  label={copy.paymentMethod}
                  value={part.method}
                  onChange={(event) =>
                    onUpdateSplitPart(part.id, { method: event.target.value === 'card' ? 'card' : 'cash' })
                  }
                  disabled={isPartPaid}
                  sx={{ minWidth: { xs: '100%', sm: 132 } }}>
                  <MenuItem value="cash">{copy.cash}</MenuItem>
                  <MenuItem value="card">{copy.card}</MenuItem>
                </TextField>
                <Tooltip title={validationMessage} arrow>
                  <TextField
                    label={`${copy.pay} ${index + 1}`}
                    value={part.amount}
                    type="number"
                    onChange={(event) => onUpdateSplitPart(part.id, { amount: event.target.value })}
                    error={partHasError}
                    disabled={isPartPaid}
                    fullWidth
                  />
                </Tooltip>
                {isPartPaid ? (
                  <Typography
                    variant="caption"
                    color="success.main"
                    sx={{ minWidth: 52, fontWeight: 800, textAlign: 'center' }}>
                    {copy.receiptAmount}
                  </Typography>
                ) : (
                  <IconButton aria-label={copy.removeOne} onClick={() => onRemoveSplitPart(part.id)}>
                    <Icon icon="solar:minus-circle-bold" width={22} />
                  </IconButton>
                )}
              </Stack>
            );
          })}
        </Stack>
      ) : null}
    </>
  );
}
