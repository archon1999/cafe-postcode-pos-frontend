import { Icon } from '@iconify/react';
import { alpha, Box, Button, Stack, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { canCancelKitchenOrders, canManageKitchenOrders, usePosSession } from 'modules/auth';
import {
  useKitchenQueueQuery,
  useReplayKitchenAnnouncementMutation,
  useUpdateKitchenItemStatusMutation,
  useUpdateKitchenTicketStatusMutation,
} from 'modules/kitchen/application';
import { type KitchenTicketStatus } from 'modules/kitchen/domain';
import { refreshTransportAndReload } from 'shared/api/transportResolver';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { formatTime } from 'shared/pos/utils';
import { PosKitchenQueueSkeleton, PosSettingsMenu } from 'shared/ui/pos-primitives';

import { KitchenQueueHeader, type KitchenQueueTab } from './KitchenQueueHeader';
import { getKitchenTicketContextLabel, getKitchenTicketDisplayNumber } from './kitchenTicketContext';
import { kitchenStatusMeta, KitchenTicketItem } from './KitchenTicketItem';

export function KitchenQueuePageContent() {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeColor, setThemeColor, themeMode, setThemeMode } =
    usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const copy = getPosCopy(locale);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [selectedTab, setSelectedTab] = useState<KitchenQueueTab>('active');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const canUpdateKitchenOrders = canManageKitchenOrders(session?.user);
  const canCancelKitchenItems = canCancelKitchenOrders(session?.user);

  const queueQuery = useKitchenQueueQuery();
  const updateTicketStatusMutation = useUpdateKitchenTicketStatusMutation();
  const updateItemStatusMutation = useUpdateKitchenItemStatusMutation();
  const replayAnnouncementMutation = useReplayKitchenAnnouncementMutation();
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
        <KitchenQueueHeader
          activeCount={activeTickets.length}
          copy={copy}
          doneCount={doneTickets.length}
          isMobile={isMobile}
          onLock={() => navigate('/lock-screen')}
          onRefresh={() => void refreshTransportAndReload()}
          onSelectTab={setSelectedTab}
          onSettings={setSettingsAnchor}
          selectedTab={selectedTab}
        />
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
              const meta = kitchenStatusMeta[ticket.status];

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
                            {getKitchenTicketContextLabel(ticket, copy)}
                          </Typography>
                        </Stack>
                        <Stack spacing={0.18} alignItems="flex-end">
                          <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>
                            #{getKitchenTicketDisplayNumber(ticket)}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#9a9fa8', fontSize: 13 }}>
                            {formatTime(ticket.createdAt, locale)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>

                    <Stack spacing={1.05} sx={{ px: 1.45, pb: 1.45 }}>
                      {ticket.items.map((item) => (
                        <KitchenTicketItem
                          key={item.id}
                          canCancel={canCancelKitchenItems}
                          canUpdate={canUpdateKitchenOrders}
                          copy={copy}
                          isSelected={selectedItemId === item.id}
                          item={item}
                          onSelect={(itemId) =>
                            setSelectedItemId((currentValue) => (currentValue === itemId ? null : itemId))
                          }
                          onUpdateStatus={(itemId, status) => updateItemStatusMutation.mutate({ itemId, status })}
                          selectedTab={selectedTab}
                        />
                      ))}

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
                        <Stack spacing={1.1}>
                          <Stack direction="row" spacing={0.9} alignItems="center">
                            <Icon icon={meta.icon} width={20} color={meta.color} />
                            <Typography variant="body2" color="text.secondary">
                              {copy.completedOrders}
                            </Typography>
                          </Stack>
                          {canUpdateKitchenOrders && ticket.canAnnounce !== false ? (
                            <Button
                              variant="outlined"
                              disabled={
                                replayAnnouncementMutation.isPending &&
                                replayAnnouncementMutation.variables?.ticketId === ticket.id
                              }
                              startIcon={<Icon icon="solar:volume-loud-bold" width={20} />}
                              onClick={(event) => {
                                event.stopPropagation();
                                replayAnnouncementMutation.mutate(
                                  { ticketId: ticket.id },
                                  {
                                    onSuccess: () => toast.success(copy.announcementQueued),
                                    onError: () => toast.error(copy.announcementFailed),
                                  },
                                );
                              }}
                              sx={{ minHeight: 44, borderRadius: '14px', fontWeight: 700 }}>
                              {copy.announceOnTv}
                            </Button>
                          ) : null}
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
        onThemeColorChange={setThemeColor}
        onSignOut={() => {
          setSession(null);
          void navigate('/pin-login', { replace: true });
        }}
        themeColor={themeColor}
        themeMode={themeMode}
      />
    </PosPageFrame>
  );
}
