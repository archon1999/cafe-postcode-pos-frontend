import { Icon } from '@iconify/react';
import { alpha, Box, Button, Stack, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { canCancelKitchenOrders, canManageKitchenOrders, getPosHomePath, usePosSession } from 'modules/auth';
import {
  useKitchenQueueQuery,
  useUpdateKitchenItemStatusMutation,
  useUpdateKitchenTicketStatusMutation,
} from 'modules/kitchen/application';
import { type KitchenItemStatus, type KitchenTicketStatus } from 'modules/kitchen/domain';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { formatTime } from 'shared/pos/utils';
import { PosIconAction, PosKitchenQueueSkeleton, PosSettingsMenu } from 'shared/ui/pos-primitives';

const statusMeta = {
  new: {
    icon: 'solar:clock-circle-bold',
    color: '#f0b63b',
    labelColor: '#e0ab39',
  },
  cooking: {
    icon: 'solar:fire-square-bold',
    color: '#f0b63b',
    labelColor: '#e0ab39',
  },
  done: {
    icon: 'solar:check-circle-bold-duotone',
    color: '#2bc8c2',
    labelColor: '#2bc8c2',
  },
  cancelled: {
    icon: 'solar:close-circle-bold',
    color: '#d9636b',
    labelColor: '#d9636b',
  },
} as const;

export function KitchenQueuePageContent() {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeMode, setThemeMode } = usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const copy = getPosCopy(locale);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [selectedTab, setSelectedTab] = useState<'active' | 'done'>('active');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const canUpdateKitchenOrders = canManageKitchenOrders(session?.user);
  const canCancelKitchenItems = canCancelKitchenOrders(session?.user);

  const queueQuery = useKitchenQueueQuery();
  const updateTicketStatusMutation = useUpdateKitchenTicketStatusMutation();
  const updateItemStatusMutation = useUpdateKitchenItemStatusMutation();
  const isInitialLoading = queueQuery.isLoading && !queueQuery.data;

  const activeTickets = useMemo(
    () => (queueQuery.data ?? []).filter((ticket) => ticket.status === 'new' || ticket.status === 'cooking'),
    [queueQuery.data],
  );
  const doneTickets = useMemo(
    () => (queueQuery.data ?? []).filter((ticket) => ticket.status === 'done'),
    [queueQuery.data],
  );
  const visibleTickets = selectedTab === 'active' ? activeTickets : doneTickets;

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    const itemStillVisible = visibleTickets.some((ticket) => ticket.items.some((item) => item.id === selectedItemId));
    if (!itemStillVisible) {
      setSelectedItemId(null);
    }
  }, [selectedItemId, visibleTickets]);

  useEffect(() => {
    if (!selectedTicketId) {
      return;
    }

    const ticketStillVisible = visibleTickets.some((ticket) => ticket.id === selectedTicketId);
    if (!ticketStillVisible) {
      setSelectedTicketId(null);
    }
  }, [selectedTicketId, visibleTickets]);

  if (isInitialLoading) {
    return <PosKitchenQueueSkeleton />;
  }

  return (
    <PosPageFrame
      header={
        <Stack
          direction="row"
          spacing={{ xs: 1, md: 1.5 }}
          justifyContent="space-between"
          alignItems="center"
          sx={{ flexWrap: 'nowrap' }}>
          <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ flex: 1, minWidth: 0 }}>
            {!isMobile ? (
              <PosIconAction icon="solar:alt-arrow-left-bold" onClick={() => navigate(getPosHomePath(session))} />
            ) : null}

            <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ flex: 1, minWidth: 0, maxWidth: 1220 }}>
              {[
                { value: 'active', label: `${copy.activeOrders} (${activeTickets.length})` },
                {
                  value: 'done',
                  label: `${isMobile ? copy.done : copy.completedOrders} (${doneTickets.length})`,
                },
              ].map((item) => {
                const active = selectedTab === item.value;

                return (
                  <Button
                    key={item.value}
                    variant="contained"
                    onClick={() => setSelectedTab(item.value as 'active' | 'done')}
                    sx={(theme) => ({
                      flex: 1,
                      minHeight: { xs: 56, md: 70 },
                      borderRadius: { xs: '14px', md: '16px' },
                      backgroundImage: 'none',
                      backgroundColor: active
                        ? theme.palette.primary.main
                        : theme.palette.mode === 'dark'
                          ? '#2b2d31'
                          : alpha('#fffaf3', 0.94),
                      color: active ? '#ffffff' : theme.palette.mode === 'dark' ? '#a2a6ad' : '#5f6773',
                      fontSize: { xs: 14, md: 17 },
                      fontWeight: 600,
                      justifyContent: 'center',
                      position: 'relative',
                      border: `1px solid ${
                        active
                          ? 'transparent'
                          : alpha(
                              theme.palette.mode === 'dark' ? '#ffffff' : '#6c5330',
                              theme.palette.mode === 'dark' ? 0 : 0.1,
                            )
                      }`,
                      boxShadow: active
                        ? '0 12px 22px rgba(27,132,236,0.24)'
                        : theme.palette.mode === 'dark'
                          ? 'none'
                          : '0 12px 24px rgba(78, 55, 28, 0.08)',
                      '&:hover': {
                        backgroundColor: active
                          ? theme.palette.primary.dark
                          : theme.palette.mode === 'dark'
                            ? '#303339'
                            : '#f4ecdf',
                      },
                    })}>
                    {item.label}
                  </Button>
                );
              })}
            </Stack>
          </Stack>

          <Stack
            direction="row"
            spacing={{ xs: 1, md: 1.5 }}
            sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
            {!isMobile ? (
              <PosIconAction icon="solar:refresh-bold-duotone" onClick={() => window.location.reload()} />
            ) : null}
            <PosIconAction
              icon="solar:settings-bold-duotone"
              onClick={(event) => setSettingsAnchor(event.currentTarget)}
            />
            {!isMobile ? (
              <PosIconAction icon="solar:lock-password-bold-duotone" onClick={() => navigate('/lock-screen')} />
            ) : null}
          </Stack>
        </Stack>
      }>
      {visibleTickets.length > 0 ? (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            pr: { md: 0.2 },
          }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.55,
              pb: 0.4,
            }}>
            {visibleTickets.map((ticket) => {
              const meta = statusMeta[ticket.status];

              return (
                <Box
                  key={ticket.id}
                  onClick={() => {
                    if (selectedTab !== 'active') {
                      return;
                    }

                    setSelectedTicketId((currentValue) => (currentValue === ticket.id ? null : ticket.id));
                  }}
                  sx={(theme) => ({
                    borderRadius: '22px',
                    overflow: 'hidden',
                    backgroundColor: theme.palette.mode === 'dark' ? '#26292e' : '#f6eee4',
                    border: `1px solid ${
                      selectedTicketId === ticket.id
                        ? alpha(theme.palette.primary.main, 0.32)
                        : alpha('#ffffff', theme.palette.mode === 'dark' ? 0.03 : 0.28)
                    }`,
                    minHeight: isMobile ? 0 : 420,
                    boxShadow: selectedTicketId === ticket.id ? '0 12px 24px rgba(17, 120, 224, 0.06)' : 'none',
                    cursor: selectedTab === 'active' ? 'pointer' : 'default',
                  })}>
                  <Stack spacing={1.15}>
                    <Box
                      sx={(theme) => ({
                        px: 2.05,
                        py: 1.45,
                        backgroundColor: theme.palette.mode === 'dark' ? '#35383d' : '#ddd5c8',
                      })}>
                      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                        <Stack spacing={0.18}>
                          <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.15 }}>
                            {ticket.waiterName || copy.kitchen}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#9a9fa8', fontSize: 13 }}>
                            {ticket.hallName || copy.takeawayLabel}, {ticket.tableName || copy.takeawayLabel}
                          </Typography>
                        </Stack>
                        <Stack spacing={0.18} alignItems="flex-end">
                          <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>
                            A{String(ticket.orderNumber).padStart(5, '0')}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#9a9fa8', fontSize: 13 }}>
                            {formatTime(ticket.createdAt, locale)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>

                    <Stack spacing={1.05} sx={{ px: 1.45, pb: 1.45 }}>
                      {ticket.items.map((item) => {
                        const itemMeta = statusMeta[item.status];
                        const isSelected = selectedItemId === item.id;
                        const canStart = item.status === 'new';
                        const canReady = item.status !== 'done' && item.status !== 'cancelled';
                        const canCancel = item.status !== 'cancelled' && item.status !== 'done';

                        return (
                          <Box
                            key={item.id}
                            sx={(theme) => ({
                              borderRadius: '16px',
                              px: 1.3,
                              py: 1.2,
                              backgroundColor: theme.palette.mode === 'dark' ? '#33363b' : '#e8dfd2',
                              border: `1px solid ${isSelected ? alpha(theme.palette.primary.main, 0.65) : alpha('#ffffff', 0.03)}`,
                              boxShadow: isSelected ? '0 10px 26px rgba(21, 120, 224, 0.14)' : 'none',
                            })}>
                            <Stack spacing={1}>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                spacing={1.2}
                                alignItems="flex-start"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (selectedTab !== 'active') {
                                    return;
                                  }

                                  setSelectedItemId((currentValue) => (currentValue === item.id ? null : item.id));
                                }}
                                sx={{
                                  cursor: selectedTab === 'active' ? 'pointer' : 'default',
                                }}>
                                <Stack spacing={0.35} sx={{ pr: 1 }}>
                                  <Typography sx={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.2 }}>
                                    {item.catalogItemName} (x{item.quantity})
                                  </Typography>
                                  {item.note ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                                      {item.note}
                                    </Typography>
                                  ) : null}
                                </Stack>

                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    display: 'grid',
                                    placeItems: 'center',
                                    backgroundColor: alpha(itemMeta.color, 0.14),
                                    flexShrink: 0,
                                  }}>
                                  <Icon icon={itemMeta.icon} width={16} color={itemMeta.color} />
                                </Box>
                              </Stack>

                              {selectedTab === 'active' && isSelected && canUpdateKitchenOrders ? (
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.9}>
                                  {canStart ? (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      sx={(theme) => ({
                                        flex: 1,
                                        minHeight: 42,
                                        backgroundImage: 'none',
                                        borderRadius: '14px',
                                        backgroundColor: theme.palette.mode === 'dark' ? '#8c5a4a' : '#c97a63',
                                        fontSize: 13.5,
                                        fontWeight: 700,
                                      })}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateItemStatusMutation.mutate({
                                          itemId: item.id,
                                          status: 'cooking' as KitchenItemStatus,
                                        });
                                      }}>
                                      {copy.startCooking}
                                    </Button>
                                  ) : null}

                                  {canReady ? (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      sx={(theme) => ({
                                        flex: 1,
                                        minHeight: 42,
                                        backgroundImage: 'none',
                                        borderRadius: '14px',
                                        backgroundColor: theme.palette.mode === 'dark' ? '#2f8a84' : '#31a59d',
                                        fontSize: 13.5,
                                        fontWeight: 700,
                                      })}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateItemStatusMutation.mutate({
                                          itemId: item.id,
                                          status: 'done' as KitchenItemStatus,
                                        });
                                      }}>
                                      {copy.markReady}
                                    </Button>
                                  ) : null}

                                  {canCancel && canCancelKitchenItems ? (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      sx={(theme) => ({
                                        flex: 1,
                                        minHeight: 42,
                                        backgroundImage: 'none',
                                        borderRadius: '14px',
                                        backgroundColor: theme.palette.mode === 'dark' ? '#8b4a53' : '#c8646d',
                                        fontSize: 13.5,
                                        fontWeight: 700,
                                      })}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateItemStatusMutation.mutate({
                                          itemId: item.id,
                                          status: 'cancelled' as KitchenItemStatus,
                                        });
                                      }}>
                                      {copy.cancelItem}
                                    </Button>
                                  ) : null}
                                </Stack>
                              ) : null}
                            </Stack>
                          </Box>
                        );
                      })}

                      {selectedTab === 'active' && selectedTicketId === ticket.id && canUpdateKitchenOrders ? (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          {ticket.status === 'new' ? (
                            <Button
                              variant="contained"
                              sx={(theme) => ({
                                flex: 1,
                                minHeight: 48,
                                borderRadius: '16px',
                                backgroundImage: 'none',
                                backgroundColor: theme.palette.mode === 'dark' ? '#8c5a4a' : '#ca7c65',
                                fontSize: 14,
                                fontWeight: 700,
                              })}
                              onClick={(event) => {
                                event.stopPropagation();
                                updateTicketStatusMutation.mutate({
                                  ticketId: ticket.id,
                                  status: 'cooking' as KitchenTicketStatus,
                                });
                              }}>
                              {copy.startCooking}
                            </Button>
                          ) : null}

                          <Button
                            variant="contained"
                            sx={(theme) => ({
                              flex: 1,
                              minHeight: 48,
                              borderRadius: '16px',
                              backgroundImage: 'none',
                              backgroundColor: theme.palette.mode === 'dark' ? '#2f8a84' : '#32a79f',
                              fontSize: 14,
                              fontWeight: 700,
                            })}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateTicketStatusMutation.mutate({
                                ticketId: ticket.id,
                                status: 'done' as KitchenTicketStatus,
                              });
                            }}>
                            {copy.markReady}
                          </Button>
                        </Stack>
                      ) : selectedTab === 'done' ? (
                        <Stack direction="row" spacing={0.9} alignItems="center">
                          <Icon icon={meta.icon} width={20} color={meta.color} />
                          <Typography variant="body2" color="text.secondary">
                            {copy.completedOrders}
                          </Typography>
                        </Stack>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Box>
      ) : (
        <Box
          sx={(theme) => ({
            flex: 1,
            minHeight: 0,
            borderRadius: '22px',
            display: 'grid',
            placeItems: 'center',
            backgroundColor: theme.palette.mode === 'dark' ? '#26292e' : alpha('#ffffff', 0.72),
          })}>
          <Typography variant="h6" color="text.secondary">
            {copy.kitchenEmpty}
          </Typography>
        </Box>
      )}

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onLock={isMobile ? () => navigate('/lock-screen') : undefined}
        onThemeToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        onSignOut={() => {
          setSession(null);
          navigate('/pin-login', { replace: true });
        }}
        themeMode={themeMode}
      />
    </PosPageFrame>
  );
}
