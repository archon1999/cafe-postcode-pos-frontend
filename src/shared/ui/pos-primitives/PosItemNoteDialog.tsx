import { Icon } from '@iconify/react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  alpha,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { getPosCopy, type PosLocale } from 'shared/locale/copy';

import { normalizePosItemNote, PosItemNoteField } from './PosItemNoteField';

type Props = {
  initialNote?: string | null;
  itemLabel: string;
  locale: PosLocale;
  onClose: () => void;
  onSave: (note: string) => void;
  open: boolean;
  saving?: boolean;
};

export function PosItemNoteDialog({ initialNote, itemLabel, locale, onClose, onSave, open, saving = false }: Props) {
  const copy = getPosCopy(locale);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote(initialNote ?? '');
  }, [initialNote, open]);

  const normalizedNote = normalizePosItemNote(note);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        <Typography component="span" variant="h5" fontWeight={850} sx={{ display: 'block' }}>
          {initialNote ? copy.itemNoteEdit : copy.itemNoteAdd}
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.45 }}>
          {itemLabel}
        </Typography>
        <IconButton
          aria-label={copy.close}
          disabled={saving}
          onClick={onClose}
          sx={(theme) => ({
            position: 'absolute',
            top: 14,
            right: 14,
            bgcolor: alpha(theme.palette.text.primary, 0.06),
          })}>
          <Icon icon="solar:close-circle-bold" width={24} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <PosItemNoteField autoFocus locale={locale} onChange={setNote} value={note} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {initialNote ? (
          <Button
            color="inherit"
            disabled={saving}
            onClick={() => onSave('')}
            startIcon={<Icon icon="solar:trash-bin-trash-bold-duotone" width={19} />}>
            {copy.itemNoteRemove}
          </Button>
        ) : null}
        <Button
          variant="contained"
          disabled={saving || normalizedNote === normalizePosItemNote(initialNote ?? '')}
          onClick={() => onSave(normalizedNote)}>
          {copy.itemNoteSave}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
