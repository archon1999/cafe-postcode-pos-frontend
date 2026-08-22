import { Stack, TextField, Typography } from '@mui/material';

import { getPosCopy, type PosLocale } from 'shared/locale/copy';

export const POS_ITEM_NOTE_MAX_LENGTH = 500;

export function normalizePosItemNote(value: string) {
  return value.trim();
}

type Props = {
  autoFocus?: boolean;
  locale: PosLocale;
  minRows?: number;
  onChange: (value: string) => void;
  value: string;
};

export function PosItemNoteField({ autoFocus = false, locale, minRows = 2, onChange, value }: Props) {
  const copy = getPosCopy(locale);

  return (
    <Stack spacing={0.75}>
      <Typography variant="body2" color="text.secondary" fontWeight={700}>
        {copy.itemNote}
      </Typography>
      <TextField
        autoFocus={autoFocus}
        fullWidth
        placeholder={copy.itemNotePlaceholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        multiline
        minRows={minRows}
        helperText={`${value.length}/${POS_ITEM_NOTE_MAX_LENGTH}`}
        slotProps={{
          htmlInput: {
            'aria-label': copy.itemNote,
            maxLength: POS_ITEM_NOTE_MAX_LENGTH,
          },
        }}
      />
    </Stack>
  );
}
