import { Icon } from '@iconify/react';
import { Box, Button, Dialog, DialogContent, IconButton, Stack, Typography, alpha, useMediaQuery } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import type { CashierMenuItem, CashierMenuItemGroup } from 'modules/cashier/domain';
import { formatPosCopy, getPosCopy, type PosLocale } from 'shared/locale/copy';
import {
  defaultModifierSelections,
  modifierPriceDelta,
  modifierSelectionsValid,
  selectedModifierOptions,
  type PosModifierSelection,
} from 'shared/pos/modifiers';
import { formatCompactMoney } from 'shared/pos/utils';
import { PosProductConfiguratorDialog } from 'shared/ui/pos-primitives';

export type CashierGroupOrderLine = {
  item: CashierMenuItem;
  quantity: number;
  selections: PosModifierSelection[];
};

type InternalLine = CashierGroupOrderLine & {
  key: string;
  label: string;
  memberId: string;
};

type Props = {
  group: CashierMenuItemGroup | null;
  locale: PosLocale;
  onClose: () => void;
  onConfirm: (lines: CashierGroupOrderLine[]) => void;
  copy: {
    addToOrder: string;
    free: string;
    optional: string;
    required: string;
    selectOne: string;
    selectUpTo: string;
    selectedCount: string;
  };
};

export function CashierItemGroupConfiguratorDialog({ group, locale, onClose, onConfirm, copy }: Props) {
  const posCopy = getPosCopy(locale);
  const fullScreen = useMediaQuery('(max-width:700px)');
  const [lines, setLines] = useState<InternalLine[]>([]);
  const [customizing, setCustomizing] = useState<{ memberId: string; item: CashierMenuItem } | null>(null);

  useEffect(() => {
    setLines(group ? group.members.flatMap((member) => buildQuickLines(member.id, member.item)) : []);
    setCustomizing(null);
  }, [group]);

  const selectedLines = lines.filter((line) => line.quantity > 0);
  const totalQuantity = selectedLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalPrice = selectedLines.reduce(
    (sum, line) =>
      sum +
      line.quantity * (Number(line.item.price) + modifierPriceDelta(line.item.modifierGroups ?? [], line.selections)),
    0,
  );
  const linesByMember = useMemo(() => {
    const result = new Map<string, InternalLine[]>();
    for (const line of lines) result.set(line.memberId, [...(result.get(line.memberId) ?? []), line]);
    return result;
  }, [lines]);

  if (!group) return null;

  const changeQuantity = (key: string, delta: number) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line)),
    );
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        fullScreen={fullScreen}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: fullScreen ? 0 : '24px',
            maxHeight: fullScreen ? '100%' : '92vh',
            overflow: 'hidden',
            backgroundImage: 'none',
          },
        }}>
        <DialogContent sx={{ p: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: '-0.03em' }}>
                {group.name}
              </Typography>
            </Box>
            <IconButton
              aria-label="Yopish"
              onClick={onClose}
              sx={(theme) => ({ bgcolor: alpha(theme.palette.text.primary, 0.06) })}>
              <Icon icon="solar:close-circle-bold" width={24} />
            </IconButton>
          </Stack>

          <Stack spacing={1.4} sx={{ px: { xs: 1.4, sm: 2.4 }, pb: 2.4, overflowY: 'auto' }}>
            {group.members.map((member) => {
              const memberLines = linesByMember.get(member.id) ?? [];
              const memberQuantity = memberLines.reduce((sum, line) => sum + line.quantity, 0);
              return (
                <Box
                  key={member.id}
                  sx={(theme) => ({
                    borderRadius: '18px',
                    overflow: 'hidden',
                    border: `1px solid ${alpha(theme.palette.text.primary, 0.09)}`,
                    bgcolor: alpha(theme.palette.background.default, 0.55),
                  })}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.6 }}>
                    <Stack
                      direction="row"
                      alignItems="baseline"
                      justifyContent="space-between"
                      spacing={2}
                      sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={800} sx={{ minWidth: 0 }}>
                        {member.item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {formatCompactMoney(Number(member.item.price), locale)}
                      </Typography>
                    </Stack>
                    {memberQuantity > 0 ? (
                      <Typography color="primary.main" fontWeight={850}>
                        {formatPosCopy(posCopy.selectedCount, { count: memberQuantity })}
                      </Typography>
                    ) : null}
                  </Stack>

                  <Stack>
                    {memberLines.map((line) => {
                      const unitPrice =
                        Number(line.item.price) + modifierPriceDelta(line.item.modifierGroups ?? [], line.selections);
                      return (
                        <Stack
                          key={line.key}
                          direction="row"
                          alignItems="center"
                          spacing={1.2}
                          sx={(theme) => ({
                            px: 2,
                            py: 1.15,
                            minHeight: 58,
                            borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.07)}`,
                            bgcolor: line.quantity ? alpha(theme.palette.primary.main, 0.055) : 'transparent',
                          })}>
                          <Stack
                            direction="row"
                            alignItems="baseline"
                            justifyContent="space-between"
                            spacing={2}
                            sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={line.quantity ? 750 : 550} sx={{ minWidth: 0 }}>
                              {line.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                              {formatCompactMoney(unitPrice, locale)}
                            </Typography>
                          </Stack>
                          <CounterButton
                            icon="solar:minus-circle-bold"
                            disabled={!line.quantity}
                            onClick={() => changeQuantity(line.key, -1)}
                          />
                          <Typography
                            sx={{
                              width: 28,
                              textAlign: 'center',
                              fontWeight: 900,
                              fontVariantNumeric: 'tabular-nums',
                            }}>
                            {line.quantity}
                          </Typography>
                          <CounterButton icon="solar:add-circle-bold" onClick={() => changeQuantity(line.key, 1)} />
                        </Stack>
                      );
                    })}
                  </Stack>

                  {member.item.modifierGroups?.length ? (
                    <Button
                      color="inherit"
                      startIcon={<Icon icon="solar:tuning-2-bold-duotone" width={19} />}
                      onClick={() => setCustomizing({ memberId: member.id, item: member.item })}
                      sx={{ m: 1, justifyContent: 'flex-start' }}>
                      {posCopy.itemGroupCustomCombination}
                    </Button>
                  ) : null}
                </Box>
              );
            })}
          </Stack>

          <Box
            sx={(theme) => ({
              mt: 'auto',
              p: { xs: 1.5, sm: 2.2 },
              borderTop: `1px solid ${theme.palette.divider}`,
              bgcolor: alpha(theme.palette.background.paper, 0.95),
            })}>
            <Button
              fullWidth
              size="large"
              variant="contained"
              disabled={!totalQuantity}
              onClick={() =>
                onConfirm(selectedLines.map(({ item, quantity, selections }) => ({ item, quantity, selections })))
              }
              sx={{ minHeight: 58, borderRadius: '16px', fontWeight: 850 }}>
              {totalQuantity
                ? `${totalQuantity} ta qo‘shish · ${formatCompactMoney(totalPrice, locale)}`
                : 'Miqdorni tanlang'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {customizing ? (
        <PosProductConfiguratorDialog
          item={customizing.item}
          locale={locale}
          copy={copy}
          onClose={() => setCustomizing(null)}
          onConfirm={(item, selections) => {
            const key = `${customizing.memberId}:${selectionKey(selections)}`;
            setLines((current) => {
              const existing = current.find((line) => line.key === key);
              if (existing)
                return current.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line));
              return [
                ...current,
                {
                  key,
                  memberId: customizing.memberId,
                  item,
                  quantity: 1,
                  selections,
                  label: selectionLabel(item, selections),
                },
              ];
            });
            setCustomizing(null);
          }}
        />
      ) : null}
    </>
  );
}

function buildQuickLines(memberId: string, item: CashierMenuItem): InternalLine[] {
  const groups = item.modifierGroups ?? [];
  if (!groups.length) return [createLine(memberId, item, [], 'Oddiy')];
  if (groups.length === 1 && groups[0].selectionType === 'single') {
    return groups[0].options.map((option) =>
      createLine(memberId, item, [{ group: groups[0].id, options: [option.id] }], option.name),
    );
  }
  const defaults = defaultModifierSelections(groups);
  return modifierSelectionsValid(groups, defaults)
    ? [createLine(memberId, item, defaults, selectionLabel(item, defaults))]
    : [];
}

function createLine(
  memberId: string,
  item: CashierMenuItem,
  selections: PosModifierSelection[],
  label: string,
): InternalLine {
  return { key: `${memberId}:${selectionKey(selections)}`, memberId, item, selections, label, quantity: 0 };
}

function selectionKey(selections: PosModifierSelection[]) {
  return (
    selections
      .map((selection) => `${selection.group}:${[...selection.options].sort().join(',')}`)
      .sort()
      .join('|') || 'plain'
  );
}

function selectionLabel(item: CashierMenuItem, selections: PosModifierSelection[]) {
  const labels = selectedModifierOptions(item.modifierGroups ?? [], selections).map(({ option }) => option.name);
  return labels.join(' + ') || 'Oddiy';
}

function CounterButton({ icon, disabled = false, onClick }: { icon: string; disabled?: boolean; onClick: () => void }) {
  const label = icon.includes('minus') ? 'Miqdorni kamaytirish' : 'Miqdorni ko‘paytirish';
  return (
    <IconButton
      aria-label={label}
      size="small"
      disabled={disabled}
      onClick={onClick}
      sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
      <Icon icon={icon} width={21} />
    </IconButton>
  );
}
