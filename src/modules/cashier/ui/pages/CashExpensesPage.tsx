import { Icon } from '@iconify/react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { canCreateCashExpense, canManageCashShift, canVoidCashExpense, getPosHomePath, usePosSession } from 'modules/auth';
import {
  useCashExpensesQuery,
  useCashierContextQuery,
  useCreateCashExpenseMutation,
  useVoidCashExpenseMutation,
} from 'modules/cashier/application';
import type { CashExpense } from 'modules/cashier/domain';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { PosIconAction } from 'shared/ui/pos-primitives';

const formatMoney = (value: number) => new Intl.NumberFormat('uz-UZ').format(value);

export function CashExpensesPage() {
  const navigate = useNavigate();
  const { session } = usePosSession();
  const canCreate = canCreateCashExpense(session?.user);
  const canVoid = canVoidCashExpense(session?.user);
  const canSelectShift = canManageCashShift(session?.user);
  const contextQuery = useCashierContextQuery({ enabled: canCreate });
  const shifts = useMemo(() => {
    const active = contextQuery.data?.activeShifts ?? [];
    const current = contextQuery.data?.currentShift;
    if (active.length) return active;
    return current ? [current] : [];
  }, [contextQuery.data]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [comment, setComment] = useState('');
  const [voidExpense, setVoidExpense] = useState<CashExpense | null>(null);
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    if (!selectedShiftId && shifts[0]?.id) setSelectedShiftId(shifts[0].id);
    if (selectedShiftId && !shifts.some((shift) => shift.id === selectedShiftId)) {
      setSelectedShiftId(shifts[0]?.id ?? '');
    }
  }, [selectedShiftId, shifts]);

  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId) ?? null;
  const expensesQuery = useCashExpensesQuery(canSelectShift ? selectedShiftId || undefined : undefined, Boolean(selectedShiftId));
  const createMutation = useCreateCashExpenseMutation({
    onSuccess: () => {
      setAmount('');
      setComment('');
      toast.success('Xarajat kassaga yozildi.');
      void contextQuery.refetch();
      void expensesQuery.refetch();
    },
  });
  const voidMutation = useVoidCashExpenseMutation({
    onSuccess: () => {
      setVoidExpense(null);
      setVoidReason('');
      toast.success('Xarajat bekor qilindi.');
      void contextQuery.refetch();
      void expensesQuery.refetch();
    },
  });

  if (!canCreate) return <Navigate to={getPosHomePath(session)} replace />;

  const categories = contextQuery.data?.expenseCategories ?? [];
  const recipients = contextQuery.data?.expenseRecipients ?? [];
  const numericAmount = Number(amount || 0);
  const canSubmit = Boolean(
    selectedShift && categoryId && numericAmount > 0 && numericAmount <= selectedShift.expectedClosingCashAmount,
  );

  const submit = async () => {
    try {
      await createMutation.mutateAsync({
        cashShiftId: canSelectShift ? selectedShiftId : undefined,
        amount: numericAmount,
        categoryId,
        recipientId: recipientId || undefined,
        comment,
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Xarajatni saqlab bo‘lmadi.'));
    }
  };

  return (
    <PosPageFrame
      header={
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PosIconAction icon="solar:alt-arrow-left-bold" onClick={() => navigate(-1)} />
          <Box>
            <Typography variant="h4">Kassa xarajatlari</Typography>
            <Typography color="text.secondary">Naqd pul chiqimini smenaga yozish</Typography>
          </Box>
        </Stack>
      }>
      <Box sx={{ overflowY: 'auto', pb: 3 }}>
        <Stack spacing={2.5} sx={{ maxWidth: 920, mx: 'auto' }}>
          {!shifts.length && !contextQuery.isLoading ? (
            <Alert severity="warning">Xarajat kiritish uchun aktiv smena bo‘lishi kerak.</Alert>
          ) : null}
          {!categories.length && !contextQuery.isLoading ? (
            <Alert severity="info">Admin panelda avval xarajat kategoriyasini yarating.</Alert>
          ) : null}

          <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  fullWidth
                  label="Kassa / smena"
                  value={selectedShiftId}
                  onChange={(event) => setSelectedShiftId(event.target.value)}>
                  {shifts.map((shift) => (
                    <MenuItem key={shift.id} value={shift.id}>
                      {shift.cashDeskName || 'Kassa'} — {shift.cashierName || 'Kassir'}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  type="number"
                  label="Summa"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  helperText={
                    selectedShift ? `Mavjud naqd: ${formatMoney(selectedShift.expectedClosingCashAmount)} UZS` : '—'
                  }
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  fullWidth
                  label="Xarajat kategoriyasi"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Pulni oluvchi"
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}>
                  <MenuItem value="">Ko‘rsatilmagan</MenuItem>
                  {recipients.map((recipient) => (
                    <MenuItem key={recipient.id} value={recipient.id}>
                      {recipient.fullName || recipient.username}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Izoh"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <Button
                size="large"
                variant="contained"
                color="success"
                disabled={!canSubmit || createMutation.isPending}
                onClick={() => void submit()}>
                {createMutation.isPending ? 'Saqlanmoqda…' : 'Kassadan chiqarish'}
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">Smena xarajatlari</Typography>
              {expensesQuery.isLoading ? <Typography color="text.secondary">Yuklanmoqda…</Typography> : null}
              {!expensesQuery.isLoading && !expensesQuery.data?.length ? (
                <Typography color="text.secondary">Hozircha xarajat yo‘q.</Typography>
              ) : null}
              {expensesQuery.data?.map((expense, index) => (
                <Box key={expense.id}>
                  {index ? <Divider sx={{ mb: 1.5 }} /> : null}
                  <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                        <Typography variant="subtitle1">{expense.categoryName}</Typography>
                        {expense.status === 'voided' ? <Chip size="small" color="default" label="Bekor qilingan" /> : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {expense.comment || 'Izohsiz'}
                        {expense.recipientName ? ` · Oluvchi: ${expense.recipientName}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(expense.occurredAt).toLocaleString('uz-UZ')} · {expense.createdByName}
                      </Typography>
                    </Box>
                    <Stack alignItems="flex-end" spacing={0.5}>
                      <Typography variant="h6" color={expense.status === 'voided' ? 'text.disabled' : 'error.main'}>
                        −{formatMoney(expense.amount)}
                      </Typography>
                      {canVoid && expense.status === 'posted' ? (
                        <Button size="small" color="error" startIcon={<Icon icon="solar:trash-bin-trash-bold-duotone" />} onClick={() => setVoidExpense(expense)}>
                          Bekor qilish
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <Dialog open={Boolean(voidExpense)} onClose={() => setVoidExpense(null)} fullWidth maxWidth="xs">
        <DialogTitle>Xarajatni bekor qilish</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 1 }}
            label="Sabab"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidExpense(null)}>Yopish</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!voidReason.trim() || voidMutation.isPending}
            onClick={() => {
              if (voidExpense) voidMutation.mutate({ expenseId: voidExpense.id, reason: voidReason });
            }}>
            Bekor qilish
          </Button>
        </DialogActions>
      </Dialog>
    </PosPageFrame>
  );
}
