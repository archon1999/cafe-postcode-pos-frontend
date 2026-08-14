import { Icon } from '@iconify/react';
import { Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { formatPosCopy, type PosLocale, type getPosCopy } from 'shared/locale/copy';
import { formatPosQuantity, formatPosQuantityNumber } from 'shared/pos/utils';

import type { CatalogSummaryItem } from './priceHiddenCatalog.domain';

export function PriceHiddenSelectionDialog({
  copy,
  locale,
  open,
  selectedCount,
  selectedItems,
  renderControls,
  onClose,
}: {
  copy: ReturnType<typeof getPosCopy>;
  locale: PosLocale;
  open: boolean;
  selectedCount: number;
  selectedItems: CatalogSummaryItem[];
  renderControls: (catalogItemId: string) => ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          color: '#f6f6f4',
          backgroundColor: '#101214',
          backgroundImage: 'none',
          borderRadius: '18px',
          boxShadow: '0 28px 80px rgba(0,0,0,0.58)',
        },
      }}>
      <DialogTitle sx={{ pr: 1.2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack spacing={0.25}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {copy.selection}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.54)' }}>
              {formatPosCopy(copy.selectedCount, { count: selectedCount })}
            </Typography>
          </Stack>
          <IconButton aria-label={copy.closeSelection} onClick={onClose} sx={{ color: 'rgba(255,255,255,0.72)' }}>
            <Icon icon="solar:close-circle-bold-duotone" width={28} />
          </IconButton>
        </Stack>
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <DialogContent sx={{ p: 1.5 }}>
        {selectedItems.length > 0 ? (
          <Stack spacing={1}>
            {selectedItems.map((item) => (
              <Stack
                key={item.key}
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{
                  minHeight: 64,
                  px: 1.35,
                  py: 1,
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.055)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                }}>
                <Stack sx={{ minWidth: 0, flex: 1 }} spacing={0.2}>
                  <Typography variant="subtitle1" noWrap sx={{ color: '#f6f6f4', fontWeight: 900 }}>
                    {item.catalogItemName}
                  </Typography>
                  {item.note ? (
                    <Typography variant="body2" noWrap sx={{ color: 'rgba(255,255,255,0.48)' }}>
                      {item.note}
                    </Typography>
                  ) : null}
                </Stack>
                <Typography variant="h6" sx={{ minWidth: 42, color: '#d4df36', textAlign: 'right', fontWeight: 900 }}>
                  {item.saleUnit === 'kg'
                    ? formatPosQuantity(item.quantity, item.saleUnit, locale)
                    : formatPosCopy(copy.quantityOnlyLabel, {
                        quantity: formatPosQuantityNumber(item.quantity, item.saleUnit, locale),
                      })}
                </Typography>
                {renderControls(item.catalogItem)}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Stack alignItems="center" justifyContent="center" spacing={1.2} sx={{ py: 7, textAlign: 'center' }}>
            <Icon icon="solar:bill-list-bold-duotone" width={52} color="rgba(255,255,255,0.32)" />
            <Typography variant="h6" sx={{ color: '#f6f6f4', fontWeight: 900 }}>
              {copy.noSelectedItems}
            </Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
