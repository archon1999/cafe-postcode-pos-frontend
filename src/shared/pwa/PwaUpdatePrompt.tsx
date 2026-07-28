import { Alert, Button, Snackbar } from '@mui/material';
import { useEffect, useState } from 'react';

import type { PosLocale } from 'shared/locale/copy';

import { applyServiceWorkerUpdate, subscribeToServiceWorkerUpdate } from './register-service-worker';

const copy: Record<PosLocale, { message: string; update: string }> = {
  uz: {
    message: "Yangi POS versiyasi tayyor. Ochiq chek yoki to'lovni yakunlab, keyin yangilang.",
    update: 'Yangilash',
  },
  'uz-crl': {
    message: 'Янги POS версияси тайёр. Очиқ чек ёки тўловни якунлаб, кейин янгиланг.',
    update: 'Янгилаш',
  },
  ru: {
    message: 'Новая версия POS готова. Завершите открытый чек или оплату, затем обновите приложение.',
    update: 'Обновить',
  },
};

export function PwaUpdatePrompt({ locale }: { locale: PosLocale }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => subscribeToServiceWorkerUpdate(setIsReady), []);

  return (
    <Snackbar open={isReady} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert
        severity="info"
        variant="filled"
        action={
          <Button color="inherit" size="small" onClick={() => applyServiceWorkerUpdate()}>
            {copy[locale].update}
          </Button>
        }
        sx={{ alignItems: 'center', maxWidth: 720 }}>
        {copy[locale].message}
      </Alert>
    </Snackbar>
  );
}
