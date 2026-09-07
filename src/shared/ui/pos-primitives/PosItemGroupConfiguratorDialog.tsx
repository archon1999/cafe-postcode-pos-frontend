import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { formatPosCopy, getPosCopy, type PosLocale } from 'shared/locale/copy';
import { inventoryAvailabilityLabel } from 'shared/pos/inventory';
import {
  defaultModifierSelections,
  modifierPriceDelta,
  modifierSelectionsValid,
  selectedModifierOptions,
  type PosModifierSelection,
} from 'shared/pos/modifiers';
import { formatCompactMoney, formatPosQuantity } from 'shared/pos/utils';

import type { PosBuilderMenuItem, PosBuilderMenuItemGroup } from './PosBuilderCatalog';
import { PosItemNoteDialog } from './PosItemNoteDialog';
import { PosProductConfiguratorDialog } from './PosProductConfiguratorDialog';

export type PosGroupOrderLine<TItem extends PosBuilderMenuItem = PosBuilderMenuItem> = {
  item: TItem;
  note: string;
  quantity: number;
  selections: PosModifierSelection[];
};

type InternalLine<TItem extends PosBuilderMenuItem> = PosGroupOrderLine<TItem> & {
  key: string;
  label: string;
  memberId: string;
  quantityInput: string;
};

type Props<TItem extends PosBuilderMenuItem> = {
  group: PosBuilderMenuItemGroup<TItem> | null;
  locale: PosLocale;
  onClose: () => void;
  onConfirm: (lines: PosGroupOrderLine<TItem>[]) => void;
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

export function PosItemGroupConfiguratorDialog<TItem extends PosBuilderMenuItem>({
  group,
  locale,
  onClose,
  onConfirm,
  copy,
}: Props<TItem>) {
  const posCopy = getPosCopy(locale);
  const fullScreen = useMediaQuery('(max-width:700px)');
  const [lines, setLines] = useState<InternalLine<TItem>[]>([]);
  const [customizing, setCustomizing] = useState<{ memberId: string; item: TItem } | null>(null);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);

  useEffect(() => {
    setLines(group ? group.members.flatMap((member) => buildQuickLines(member.id, member.item)) : []);
    setCustomizing(null);
    setEditingLineKey(null);
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
    const result = new Map<string, InternalLine<TItem>[]>();
    for (const line of lines) result.set(line.memberId, [...(result.get(line.memberId) ?? []), line]);
    return result;
  }, [lines]);
  const editingLine = editingLineKey ? (lines.find((line) => line.key === editingLineKey) ?? null) : null;

  if (!group) return null;

  const changeQuantity = (key: string, delta: number) => {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key || (delta > 0 && line.item.inventory?.blocked)) return line;
        const quantity = Math.max(0, line.quantity + delta);
        return { ...line, quantity, quantityInput: quantity ? String(quantity) : '' };
      }),
    );
  };
  const setQuantity = (key: string, value: string) => {
    const normalized = value.replace(',', '.');
    if (normalized && !/^\d*(?:\.\d{0,3})?$/.test(normalized)) return;
    const quantity = Math.max(0, Number(normalized || 0));
    if (!Number.isFinite(quantity) || quantity > 999_999_999.999) return;
    setLines((current) =>
      current.map((line) =>
        line.key === key && !line.item.inventory?.blocked ? { ...line, quantity, quantityInput: value } : line,
      ),
    );
  };
  const setLineNote = (key: string, note: string) => {
    setLines((current) => {
      const target = current.find((line) => line.key === key);
      if (!target) return current;
      const normalizedNote = note.trim();
      const nextKey = lineKey(target.memberId, target.selections, normalizedNote);
      const matchingLine = current.find((line) => line.key === nextKey && line.key !== key);
      if (matchingLine) {
        return current
          .filter((line) => line.key !== key)
          .map((line) =>
            line.key === matchingLine.key
              ? {
                  ...line,
                  quantity: line.quantity + target.quantity,
                  quantityInput: String(line.quantity + target.quantity),
                }
              : line,
          );
      }
      return current.map((line) => (line.key === key ? { ...line, key: nextKey, note: normalizedNote } : line));
    });
    setEditingLineKey(null);
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
                        {member.item.saleUnit === 'kg'
                          ? formatPosQuantity(memberQuantity, member.item.saleUnit, locale)
                          : formatPosCopy(posCopy.selectedCount, { count: memberQuantity })}
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
                          <Stack spacing={0.35} sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
                              <Typography fontWeight={line.quantity ? 750 : 550} sx={{ minWidth: 0 }}>
                                {line.label}
                              </Typography>
                              {inventoryAvailabilityLabel(line.item.inventory, locale) ? (
                                <Typography variant="caption" color="warning.main">
                                  {inventoryAvailabilityLabel(line.item.inventory, locale)}
                                </Typography>
                              ) : null}
                              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                                {formatCompactMoney(unitPrice, locale)}
                              </Typography>
                            </Stack>
                            {line.note ? (
                              <Stack direction="row" spacing={0.55} alignItems="center">
                                <Icon icon="solar:notes-bold-duotone" width={16} />
                                <Typography variant="caption" color="text.secondary">
                                  {line.note}
                                </Typography>
                              </Stack>
                            ) : null}
                          </Stack>
                          {line.quantity ? (
                            <IconButton
                              aria-label={line.note ? posCopy.itemNoteEdit : posCopy.itemNoteAdd}
                              color={line.note ? 'primary' : 'default'}
                              onClick={() => setEditingLineKey(line.key)}
                              sx={(theme) => ({ bgcolor: alpha(theme.palette.text.primary, 0.055) })}>
                              <Icon icon="solar:notes-bold-duotone" width={21} />
                            </IconButton>
                          ) : null}
                          {line.item.saleUnit === 'kg' ? (
                            <TextField
                              size="small"
                              disabled={Boolean(line.item.inventory?.blocked)}
                              value={line.quantityInput}
                              onChange={(event) => setQuantity(line.key, event.target.value)}
                              placeholder="0"
                              slotProps={{
                                htmlInput: {
                                  inputMode: 'decimal',
                                  'aria-label': `${line.label} ${posCopy.kilogramUnit}`,
                                },
                              }}
                              sx={{ width: 104, '& input': { textAlign: 'center', fontWeight: 850 } }}
                              InputProps={{
                                endAdornment: <Typography variant="caption">{posCopy.kilogramUnit}</Typography>,
                              }}
                            />
                          ) : (
                            <>
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
                              <CounterButton
                                icon="solar:add-circle-bold"
                                disabled={Boolean(line.item.inventory?.blocked)}
                                onClick={() => changeQuantity(line.key, 1)}
                              />
                            </>
                          )}
                        </Stack>
                      );
                    })}
                  </Stack>

                  {member.item.modifierGroups?.length ? (
                    <Button
                      color="inherit"
                      disabled={Boolean(member.item.inventory?.blocked)}
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
                onConfirm(
                  selectedLines.map(({ item, note, quantity, selections }) => ({ item, note, quantity, selections })),
                )
              }
              sx={{ minHeight: 58, borderRadius: '16px', fontWeight: 850 }}>
              {totalQuantity
                ? `${selectedLines.some((line) => line.item.saleUnit === 'kg') ? selectedLines.length : totalQuantity} ${
                    selectedLines.some((line) => line.item.saleUnit === 'kg') ? 'tur' : 'ta'
                  } qo‘shish · ${formatCompactMoney(totalPrice, locale)}`
                : 'Miqdorni tanlang'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {customizing ? (
        <PosProductConfiguratorDialog
          item={customizing.item}
          allowItemNote
          locale={locale}
          copy={copy}
          onClose={() => setCustomizing(null)}
          onConfirm={(item, selections, note) => {
            const key = lineKey(customizing.memberId, selections, note);
            setLines((current) => {
              const existing = current.find((line) => line.key === key);
              if (existing) {
                const quantity = existing.quantity + 1;
                return current.map((line) =>
                  line.key === key ? { ...line, quantity, quantityInput: String(quantity) } : line,
                );
              }
              return [
                ...current,
                {
                  key,
                  memberId: customizing.memberId,
                  item,
                  note,
                  quantity: 1,
                  quantityInput: '1',
                  selections,
                  label: selectionLabel(item, selections),
                },
              ];
            });
            setCustomizing(null);
          }}
        />
      ) : null}

      <PosItemNoteDialog
        initialNote={editingLine?.note}
        itemLabel={editingLine ? `${editingLine.item.name} · ${editingLine.label}` : ''}
        locale={locale}
        onClose={() => setEditingLineKey(null)}
        onSave={(note) => editingLine && setLineNote(editingLine.key, note)}
        open={Boolean(editingLine)}
      />
    </>
  );
}

function buildQuickLines<TItem extends PosBuilderMenuItem>(memberId: string, item: TItem): InternalLine<TItem>[] {
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

function createLine<TItem extends PosBuilderMenuItem>(
  memberId: string,
  item: TItem,
  selections: PosModifierSelection[],
  label: string,
): InternalLine<TItem> {
  return {
    key: lineKey(memberId, selections, ''),
    memberId,
    item,
    note: '',
    selections,
    label,
    quantity: 0,
    quantityInput: '',
  };
}

function lineKey(memberId: string, selections: PosModifierSelection[], note: string) {
  return `${memberId}:${selectionKey(selections)}:${note.trim()}`;
}

function selectionKey(selections: PosModifierSelection[]) {
  return (
    selections
      .map((selection) => `${selection.group}:${[...selection.options].sort().join(',')}`)
      .sort()
      .join('|') || 'plain'
  );
}

function selectionLabel(item: PosBuilderMenuItem, selections: PosModifierSelection[]) {
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
      sx={{ width: 46, height: 46, flexShrink: 0, bgcolor: 'background.paper', boxShadow: 1 }}>
      <Icon icon={icon} width={27} />
    </IconButton>
  );
}
