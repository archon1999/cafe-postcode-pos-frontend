import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  Radio,
  Stack,
  Typography,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import type { PosLocale } from 'shared/locale/copy';
import {
  defaultModifierSelections,
  modifierPriceDelta,
  modifierSelectionsValid,
  type PosModifierGroup,
  type PosModifierSelection,
} from 'shared/pos/modifiers';
import { formatCompactMoney } from 'shared/pos/utils';

import { PosItemNoteField } from './PosItemNoteField';

export type ConfigurablePosMenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number | string;
  modifierGroups?: PosModifierGroup[];
};

type PosProductConfiguratorDialogProps<TItem extends ConfigurablePosMenuItem> = {
  item: TItem | null;
  locale: PosLocale;
  onClose: () => void;
  onConfirm: (item: TItem, selections: PosModifierSelection[], note: string) => void;
  allowItemNote?: boolean;
  initialNote?: string;
  initialSelections?: PosModifierSelection[];
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

export function PosProductConfiguratorDialog<TItem extends ConfigurablePosMenuItem>({
  copy,
  allowItemNote = false,
  initialNote,
  initialSelections,
  item,
  locale,
  onClose,
  onConfirm,
}: PosProductConfiguratorDialogProps<TItem>) {
  const fullScreen = useMediaQuery('(max-width:700px)');
  const groups = useMemo(() => item?.modifierGroups ?? [], [item?.modifierGroups]);
  const [selections, setSelections] = useState<PosModifierSelection[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (item) {
      setSelections(initialSelections ?? defaultModifierSelections(item.modifierGroups ?? []));
      setNote(initialNote ?? '');
    }
  }, [initialNote, initialSelections, item]);

  if (!item) return null;

  const selectedByGroup = new Map(selections.map((selection) => [selection.group, selection.options]));
  const valid = modifierSelectionsValid(groups, selections);
  const finalPrice = Number(item.price) + modifierPriceDelta(groups, selections);

  const updateGroup = (group: PosModifierGroup, optionId: string, checked: boolean) => {
    setSelections((current) => {
      const currentOptions = current.find((selection) => selection.group === group.id)?.options ?? [];
      let options: string[];
      if (group.selectionType === 'single') options = checked ? [optionId] : [];
      else if (checked) options = [...currentOptions, optionId].slice(0, group.maxSelections);
      else options = currentOptions.filter((id) => id !== optionId);
      return [...current.filter((selection) => selection.group !== group.id), { group: group.id, options }];
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : '28px',
          maxHeight: fullScreen ? '100%' : 'min(860px, 92vh)',
          overflow: 'hidden',
          backgroundImage: 'none',
          boxShadow: '0 32px 90px rgba(16, 24, 40, 0.26)',
        },
      }}>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ px: { xs: 2.2, sm: 3.4 }, pt: { xs: 2, sm: 2.6 }, pb: 2 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
            <Box sx={{ minWidth: 0, pt: 0.25 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.08 }}>
                {item.name}
              </Typography>
              {item.description ? (
                <Typography color="text.secondary" sx={{ mt: 0.8 }}>
                  {item.description}
                </Typography>
              ) : null}
              <Typography color="primary.main" sx={{ mt: 1, fontSize: 20, fontWeight: 800 }}>
                {formatCompactMoney(Number(item.price), locale)}
              </Typography>
            </Box>
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={(theme) => ({
                width: 40,
                height: 40,
                flexShrink: 0,
                bgcolor: alpha(theme.palette.text.primary, 0.06),
                '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.1) },
              })}>
              <Icon icon="solar:close-circle-bold" width={24} />
            </IconButton>
          </Stack>
        </Box>

        <Stack spacing={1.5} sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 2, overflowY: 'auto' }}>
          {groups.map((group) => {
            const selected = selectedByGroup.get(group.id) ?? [];
            const helper =
              group.selectionType === 'single'
                ? copy.selectOne
                : copy.selectUpTo.replace('{{count}}', String(group.maxSelections));
            return (
              <Box
                key={group.id}
                sx={(theme) => ({
                  borderRadius: '20px',
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
                  bgcolor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.32 : 0.64),
                  overflow: 'hidden',
                })}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 2, pb: 1.1 }}>
                  <Box>
                    <Typography sx={{ fontSize: 17, fontWeight: 800 }}>{group.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {helper} · {group.minSelections > 0 ? copy.required : copy.optional}
                    </Typography>
                  </Box>
                  <Box
                    sx={(theme) => ({
                      px: 1.1,
                      py: 0.45,
                      borderRadius: 99,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      fontSize: 12,
                      fontWeight: 800,
                    })}>
                    {copy.selectedCount.replace('{{count}}', String(selected.length))}
                  </Box>
                </Stack>
                <Stack>
                  {group.options.map((option) => {
                    const checked = selected.includes(option.id);
                    const disabled =
                      !checked && group.selectionType === 'multiple' && selected.length >= group.maxSelections;
                    const Control = group.selectionType === 'single' ? Radio : Checkbox;
                    return (
                      <FormControlLabel
                        key={option.id}
                        disabled={disabled}
                        control={
                          <Control
                            checked={checked}
                            onChange={(_, nextChecked) => updateGroup(group, option.id, nextChecked)}
                          />
                        }
                        label={
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ width: '100%' }}>
                            <Typography sx={{ fontWeight: checked ? 750 : 550 }}>{option.name}</Typography>
                            <Typography
                              sx={{
                                color: Number(option.priceDelta) ? 'primary.main' : 'text.secondary',
                                fontWeight: 750,
                              }}>
                              {Number(option.priceDelta)
                                ? `+ ${formatCompactMoney(Number(option.priceDelta), locale)}`
                                : copy.free}
                            </Typography>
                          </Stack>
                        }
                        sx={(theme) => ({
                          m: 0,
                          px: 1.35,
                          py: 0.45,
                          minHeight: 54,
                          borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                          bgcolor: checked ? alpha(theme.palette.primary.main, 0.065) : 'transparent',
                          '& .MuiFormControlLabel-label': { flex: 1 },
                          transition: 'background-color 170ms cubic-bezier(.2,.8,.2,1)',
                        })}
                      />
                    );
                  })}
                </Stack>
              </Box>
            );
          })}
          {allowItemNote ? <PosItemNoteField locale={locale} onChange={setNote} value={note} /> : null}
        </Stack>

        <Box
          sx={(theme) => ({
            mt: 'auto',
            p: { xs: 1.5, sm: 2.2 },
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.background.paper, 0.94),
            backdropFilter: 'blur(18px)',
          })}>
          <Button
            fullWidth
            size="large"
            variant="contained"
            disabled={!valid}
            onClick={() => onConfirm(item, selections, note.trim())}
            sx={{ minHeight: 58, borderRadius: '17px', fontSize: 16, fontWeight: 850 }}>
            {copy.addToOrder} · {formatCompactMoney(finalPrice, locale)}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
