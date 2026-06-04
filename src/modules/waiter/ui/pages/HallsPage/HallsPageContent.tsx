import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { canAccessWaiterTables, canManageTableReservations, usePosSession } from 'modules/auth';
import { useOpenTableSessionMutation, useReserveTableMutation, useWaiterHallsQuery } from 'modules/waiter/application';
import {
  type DiningTable,
  clampGuestCount,
  getAvailableSeatCount,
  getHallGridColumns,
  getSupportedSeatCount,
  getTableCoreShape,
  getTableGridPlacement,
  getTableMeta,
  getTableStatus,
  getTableVisualState,
  getVariantMarkers,
  shouldShowAttentionDot,
  type TableVisualState,
} from 'modules/waiter/domain';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { formatElapsedMinutes } from 'shared/pos/utils';
import {
  PosHallsPageSkeleton,
  PosIconAction,
  PosLegendPill,
  PosSectionTabs,
  PosSettingsMenu,
} from 'shared/ui/pos-primitives';

const HALL_GRID_MIN_CELL_WIDTH = 126;
const HALL_GRID_ROW_HEIGHT = 134;

function formatFloorLabel(locale: string, level: number) {
  if (locale === 'uz-crl') {
    return `${level}-Т›Р°РІР°С‚`;
  }

  if (locale === 'ru') {
    return `${level} СЌС‚Р°Р¶`;
  }

  return `${level}-qavat`;
}

function getAllZonesLabel(locale: string) {
  if (locale === 'uz-crl') {
    return 'Р‘Р°СЂС‡Р°СЃРё';
  }

  if (locale === 'ru') {
    return 'Р’СЃРµ';
  }

  return 'Barchasi';
}

const tablePalette: Record<
  'dark' | 'light',
  Record<
    TableVisualState,
    {
      rail: string;
      shell: string;
      fill: string;
      numberGlow: string;
      outer: string;
      ink: string;
      meta: string;
      attentionRing: string;
    }
  >
> = {
  dark: {
    available: {
      rail: '#2a2d31',
      shell: '#2e2f33',
      fill: '#666a70',
      numberGlow: 'rgba(0, 0, 0, 0.26)',
      outer: '#232529',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    reserved: {
      rail: '#b88a29',
      shell: '#866824',
      fill: '#ffc23c',
      numberGlow: 'rgba(95, 67, 10, 0.28)',
      outer: '#453719',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    occupied: {
      rail: '#1f8e89',
      shell: '#285f5d',
      fill: '#31c8c0',
      numberGlow: 'rgba(12, 82, 79, 0.26)',
      outer: '#244f4e',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    attention: {
      rail: '#219a95',
      shell: '#285f5d',
      fill: '#31c8c0',
      numberGlow: 'rgba(12, 82, 79, 0.26)',
      outer: '#245150',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    cooking: {
      rail: '#2558b3',
      shell: '#224988',
      fill: '#2a78ff',
      numberGlow: 'rgba(17, 45, 93, 0.3)',
      outer: '#203d68',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    pending_payment: {
      rail: '#a74448',
      shell: '#8a3b3f',
      fill: '#ff4f59',
      numberGlow: 'rgba(112, 30, 37, 0.28)',
      outer: '#5f2b2f',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
    blocked: {
      rail: '#7d4a4d',
      shell: '#633a3d',
      fill: '#bf6168',
      numberGlow: 'rgba(73, 30, 34, 0.28)',
      outer: '#48282b',
      ink: '#ffffff',
      meta: 'rgba(255, 255, 255, 0.96)',
      attentionRing: 'rgba(34, 36, 40, 0.5)',
    },
  },
  light: {
    available: {
      rail: '#9aa2ad',
      shell: '#f4f6f9',
      fill: '#7a818b',
      numberGlow: 'rgba(63, 72, 83, 0.16)',
      outer: '#d8dde5',
      ink: '#ffffff',
      meta: '#5f6875',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    reserved: {
      rail: '#d0a145',
      shell: '#b88b2f',
      fill: '#ffcf5a',
      numberGlow: 'rgba(126, 89, 22, 0.18)',
      outer: '#e4d7b6',
      ink: '#fffefb',
      meta: '#7f6320',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    occupied: {
      rail: '#61b9b4',
      shell: '#338a86',
      fill: '#43cbc4',
      numberGlow: 'rgba(22, 100, 95, 0.18)',
      outer: '#b9ddda',
      ink: '#ffffff',
      meta: '#296865',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    attention: {
      rail: '#4fc0bb',
      shell: '#338a86',
      fill: '#43cbc4',
      numberGlow: 'rgba(22, 100, 95, 0.18)',
      outer: '#b9ddda',
      ink: '#ffffff',
      meta: '#296865',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    cooking: {
      rail: '#5d88d8',
      shell: '#3366bd',
      fill: '#407fff',
      numberGlow: 'rgba(31, 74, 147, 0.18)',
      outer: '#c8d7ef',
      ink: '#ffffff',
      meta: '#2d568f',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    pending_payment: {
      rail: '#d37b7f',
      shell: '#bf565d',
      fill: '#ff5b64',
      numberGlow: 'rgba(135, 45, 54, 0.18)',
      outer: '#e8c3c7',
      ink: '#ffffff',
      meta: '#84353c',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
    blocked: {
      rail: '#b38b90',
      shell: '#98666d',
      fill: '#cc8188',
      numberGlow: 'rgba(101, 58, 64, 0.18)',
      outer: '#dcc8cb',
      ink: '#ffffff',
      meta: '#73474d',
      attentionRing: 'rgba(255, 248, 239, 0.92)',
    },
  },
};

function HallTableCard({
  copy,
  table,
  onSelect,
}: {
  copy: ReturnType<typeof getPosCopy>;
  table: DiningTable;
  onSelect: (table: DiningTable) => void;
}) {
  const theme = useTheme();
  const visualState = getTableVisualState(table);
  const palette = tablePalette[theme.palette.mode === 'dark' ? 'dark' : 'light'][visualState];
  const coreShape = getTableCoreShape(table.shapeVariant);
  const metaLabel =
    visualState === 'reserved' || visualState === 'cooking' ? '' : getTableMeta(table, copy, formatElapsedMinutes);
  const markers = getVariantMarkers(table.shapeVariant);
  const isTall = coreShape === 'vertical' || Number(table.height ?? 1) > Number(table.width ?? 1);
  const activeSessionCount = table.activeSessionCount ?? table.activeSessions?.length ?? (table.activeSession ? 1 : 0);

  const numberPlateSx =
    coreShape === 'horizontal'
      ? { width: 92, height: 56, borderRadius: '18px' }
      : coreShape === 'vertical'
        ? { width: 66, height: 94, borderRadius: '20px' }
        : { width: 66, height: 66, borderRadius: '18px' };

  return (
    <Box
      component="button"
      type="button"
      data-testid={`hall-table-${table.tableNumber}`}
      aria-label={table.name}
      onClick={() => onSelect(table)}
      sx={(theme) => ({
        position: 'relative',
        width: '100%',
        height: '100%',
        border: 0,
        p: 0,
        borderRadius: '22px',
        cursor: 'pointer',
        backgroundColor: theme.palette.mode === 'dark' ? alpha(palette.outer, 0.72) : palette.outer,
        color: palette.ink,
        overflow: 'hidden',
        transition: 'transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease',
        boxShadow:
          theme.palette.mode === 'dark'
            ? 'inset 0 0 0 1px rgba(255,255,255,0.02)'
            : 'inset 0 0 0 1px rgba(40,51,65,0.06)',
        '&:hover': {
          transform: 'translateY(-2px)',
          filter: 'brightness(1.04)',
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 0 0 1px rgba(255,255,255,0.04), 0 12px 24px rgba(0,0,0,0.22)'
              : 'inset 0 0 0 1px rgba(40,51,65,0.08), 0 12px 24px rgba(76,55,31,0.12)',
        },
      })}>
      {markers.map(({ key, width, height, ...seatMarker }) => (
        <Box
          key={key}
          sx={{
            position: 'absolute',
            borderRadius: 999,
            backgroundColor: palette.rail,
            boxShadow: `0 0 18px ${alpha(palette.rail, visualState === 'available' ? 0.08 : 0.18)}`,
            width: width ?? 10,
            height: height ?? 72,
            ...seatMarker,
          }}
        />
      ))}

      <Box
        sx={(theme) => ({
          position: 'absolute',
          inset: isTall ? '12px 24px' : '16px 18px',
          borderRadius: '20px',
          backgroundColor: palette.shell,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 1.4,
          py: 1.4,
          overflow: 'hidden',
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.035)'
              : 'inset 0 1px 0 rgba(255,255,255,0.18)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0.02) 100%)',
            pointerEvents: 'none',
          },
        })}>
        <Stack
          alignItems="center"
          justifyContent={metaLabel ? 'space-between' : 'center'}
          sx={{ minHeight: '100%', width: '100%', position: 'relative', zIndex: 1, py: 0.2 }}>
          <Box
            sx={{
              ...numberPlateSx,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: palette.fill,
              color: palette.ink,
              fontSize: coreShape === 'horizontal' ? 20 : 22,
              fontWeight: 700,
              position: 'relative',
              boxShadow: `0 14px 28px ${palette.numberGlow}`,
            }}>
            {table.tableNumber}
            {shouldShowAttentionDot(table) ? (
              <Box
                sx={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: '#ff545a',
                  boxShadow: `0 0 0 4px ${palette.attentionRing}`,
                }}
              />
            ) : null}
            {activeSessionCount > 1 ? (
              <Box
                data-testid={`hall-table-${table.tableNumber}-session-badge`}
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  minWidth: 28,
                  height: 28,
                  px: 0.6,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: '#28313d',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 900,
                  lineHeight: 1,
                  boxShadow: `0 0 0 4px ${palette.attentionRing}, 0 8px 16px rgba(0,0,0,0.2)`,
                }}>
                x{activeSessionCount}
              </Box>
            ) : null}
          </Box>

          {metaLabel ? (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                fontWeight: 800,
                fontSize: 15,
                color: palette.meta,
                minHeight: 22,
                lineHeight: 1,
              }}>
              {metaLabel}
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}

export function HallsPageContent() {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeMode, setThemeMode } = usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const copy = getPosCopy(locale);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [floorAnchor, setFloorAnchor] = useState<HTMLElement | null>(null);
  const [hallAnchor, setHallAnchor] = useState<HTMLElement | null>(null);

  const hallsQuery = useWaiterHallsQuery();
  const openSessionMutation = useOpenTableSessionMutation({
    selectedTable,
    guestCount,
    onSuccess: (sessionId) => {
      setSelectedTable(null);
      void navigate(`/waiter/table-session?sessionId=${sessionId}`);
    },
  });
  const reserveTableMutation = useReserveTableMutation({
    selectedTable,
    onSuccess: () => {
      setSelectedTable(null);
    },
  });
  const canManageTables = canAccessWaiterTables(session?.user);
  const canReserveTables = canManageTableReservations(session?.user);
  const selectedTableAvailableSeats = selectedTable ? getAvailableSeatCount(selectedTable) : 0;
  const selectedTableGuestLimit = selectedTable
    ? Math.max(1, Math.min(getSupportedSeatCount(selectedTable.seatCount), selectedTableAvailableSeats || selectedTable.seatCount))
    : 4;

  const halls = useMemo(() => hallsQuery.data ?? [], [hallsQuery.data]);
  const isInitialLoading = hallsQuery.isLoading && !hallsQuery.data;
  const availableLevels = useMemo(() => (halls.length ? [1] : []), [halls.length]);
  const activeLevel = selectedLevel || String(availableLevels[0] ?? 1);
  const floorTabs = useMemo(
    () => availableLevels.map((level) => ({ value: String(level), label: formatFloorLabel(locale, level) })),
    [availableLevels, locale],
  );
  const levelScopedHalls = useMemo(() => halls, [halls]);
  const selectedHall = useMemo(() => {
    const defaultHall = levelScopedHalls[0];
    const hallId = selectedHallId || defaultHall?.id;
    return levelScopedHalls.find((hall) => hall.id === hallId) ?? defaultHall;
  }, [levelScopedHalls, selectedHallId]);
  const hallTabs = levelScopedHalls.map((hall) => ({ value: hall.id, label: hall.name }));
  const zoneTabs = useMemo(() => {
    const zones = (selectedHall?.zones ?? []).filter((zone) => zone.isActive !== false);
    if (!zones.length) {
      return [];
    }

    return [
      { value: 'all', label: getAllZonesLabel(locale) },
      ...zones.map((zone) => ({ value: zone.id, label: zone.name })),
    ];
  }, [locale, selectedHall?.zones]);
  const visibleTables = useMemo(() => {
    const tables = selectedHall?.tables ?? [];
    if (!selectedZoneId || selectedZoneId === 'all') {
      return tables;
    }
    return tables.filter((table) => table.zone === selectedZoneId);
  }, [selectedHall?.tables, selectedZoneId]);

  useEffect(() => {
    if (!zoneTabs.length) {
      if (selectedZoneId !== 'all') {
        setSelectedZoneId('all');
      }
      return;
    }

    const zoneExists = zoneTabs.some((zone) => zone.value === selectedZoneId);
    if (!zoneExists) {
      setSelectedZoneId('all');
    }
  }, [selectedZoneId, zoneTabs]);

  const hallStats = useMemo(() => {
    const stats = {
      available: 0,
      reserved: 0,
      occupied: 0,
      blocked: 0,
    };

    for (const table of visibleTables) {
      const status = getTableStatus(table);
      stats[status] += 1;
    }

    return stats;
  }, [visibleTables]);

  const legendItems = [
    { key: 'available', label: copy.available, count: hallStats.available, color: '#666a70' },
    { key: 'reserved', label: copy.reserved, count: hallStats.reserved, color: '#ffc23c' },
    { key: 'occupied', label: copy.occupied, count: hallStats.occupied, color: '#31c8c0' },
    ...(hallStats.blocked > 0
      ? [{ key: 'blocked', label: copy.blocked, count: hallStats.blocked, color: '#bf6168' }]
      : []),
  ];
  const gridColumns = getHallGridColumns(selectedHall);
  const gridRows = useMemo(
    () =>
      visibleTables.reduce((maxRows, table) => {
        const placement = getTableGridPlacement(table, gridColumns);
        return Math.max(maxRows, placement.positionY + placement.height);
      }, 1),
    [gridColumns, visibleTables],
  );

  const handleTableSelect = (currentTable: DiningTable) => {
    if (currentTable.activeSession) {
      if (!canManageTables) {
        return;
      }

      const availableSeats = getAvailableSeatCount(currentTable);
      if (availableSeats > 0) {
        const nextGuestCount = Math.max(
          1,
          Math.min(getSupportedSeatCount(currentTable.seatCount), availableSeats),
        );
        setGuestCount(nextGuestCount);
        setSelectedTable(currentTable);
        return;
      }

      void navigate(`/waiter/table-session?sessionId=${currentTable.activeSession.id}`);
      return;
    }

    if (currentTable.status === 'blocked') {
      return;
    }

    if (currentTable.status === 'reserved' && !canReserveTables) {
      return;
    }

    if (currentTable.status !== 'reserved' && !canManageTables && !canReserveTables) {
      return;
    }

    const nextGuestCount = clampGuestCount(getSupportedSeatCount(currentTable.seatCount), currentTable.seatCount);
    setGuestCount(nextGuestCount);
    setSelectedTable(currentTable);
  };

  if (isInitialLoading) {
    return <PosHallsPageSkeleton />;
  }

  return (
    <PosPageFrame
      header={
        <Stack
          direction={{ xs: 'row', md: 'row' }}
          spacing={{ xs: 1, md: 1.5 }}
          justifyContent="space-between"
          alignItems="center"
          sx={{ flexWrap: { xs: 'nowrap', md: 'nowrap' } }}>
          <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ flex: 1, minWidth: 0, alignItems: 'stretch' }}>
            {availableLevels.length > 1 ? (
              <>
                <Button
                  variant="contained"
                  onClick={(event) => setFloorAnchor(event.currentTarget)}
                  sx={(theme) => ({
                    flex: { xs: 1, md: '0 0 auto' },
                    minWidth: { xs: 0, md: 218 },
                    minHeight: { xs: 60, md: 72 },
                    justifyContent: 'space-between',
                    px: { xs: 1.6, md: 2.2 },
                    borderRadius: { xs: '16px', md: '18px' },
                    backgroundImage: 'none',
                    backgroundColor: theme.palette.mode === 'dark' ? '#2a2c30' : '#efe6d8',
                    color: theme.palette.mode === 'dark' ? '#a4a8ae' : theme.palette.text.secondary,
                    fontSize: { xs: 16, md: 18 },
                    fontWeight: 700,
                    border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.22)}`,
                    '& .MuiButton-startIcon': {
                      color: theme.palette.mode === 'dark' ? '#8e949d' : '#5e6671',
                      display: { xs: 'none', md: 'inline-flex' },
                    },
                  })}
                  startIcon={<Icon icon="solar:layers-minimalistic-bold-duotone" width={24} />}
                  endIcon={<Icon icon="solar:alt-arrow-down-line-duotone" width={20} />}>
                  {formatFloorLabel(locale, Number(activeLevel))}
                </Button>

                <Menu
                  anchorEl={floorAnchor}
                  open={Boolean(floorAnchor)}
                  onClose={() => setFloorAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  slotProps={{
                    paper: {
                      sx: (theme) => ({
                        mt: 1,
                        minWidth: 218,
                        borderRadius: '16px',
                        backgroundColor: theme.palette.mode === 'dark' ? '#26282c' : '#fffdf8',
                        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.12)}`,
                        boxShadow:
                          theme.palette.mode === 'dark'
                            ? '0 18px 40px rgba(0,0,0,0.34)'
                            : '0 18px 40px rgba(65, 46, 24, 0.14)',
                      }),
                    },
                  }}>
                  {floorTabs.map((floor) => (
                    <MenuItem
                      key={floor.value}
                      selected={floor.value === activeLevel}
                      onClick={() => {
                        setSelectedLevel(floor.value);
                        setSelectedHallId('');
                        setFloorAnchor(null);
                      }}
                      sx={{ minHeight: 48, fontWeight: floor.value === activeLevel ? 700 : 600 }}>
                      {floor.label}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            ) : null}

            {isMobile ? (
              <>
                <Button
                  variant="contained"
                  onClick={(event) => setHallAnchor(event.currentTarget)}
                  sx={(theme) => ({
                    flex: 1,
                    minWidth: 0,
                    minHeight: 60,
                    justifyContent: 'space-between',
                    px: 1.6,
                    borderRadius: '16px',
                    backgroundImage: 'none',
                    backgroundColor: theme.palette.mode === 'dark' ? '#2a2c30' : '#efe6d8',
                    color: theme.palette.mode === 'dark' ? '#a4a8ae' : theme.palette.text.secondary,
                    fontSize: 16,
                    fontWeight: 700,
                    border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.22)}`,
                  })}
                  endIcon={<Icon icon="solar:alt-arrow-down-line-duotone" width={20} />}>
                  {selectedHall?.name ?? copy.halls}
                </Button>

                <Menu
                  anchorEl={hallAnchor}
                  open={Boolean(hallAnchor)}
                  onClose={() => setHallAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  slotProps={{
                    paper: {
                      sx: (theme) => ({
                        mt: 1,
                        minWidth: 200,
                        borderRadius: '16px',
                        backgroundColor: theme.palette.mode === 'dark' ? '#26282c' : '#fffdf8',
                        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.12)}`,
                      }),
                    },
                  }}>
                  {hallTabs.map((hall) => (
                    <MenuItem
                      key={hall.value}
                      selected={hall.value === (selectedHall?.id ?? '')}
                      onClick={() => {
                        setSelectedHallId(hall.value);
                        setHallAnchor(null);
                      }}
                      sx={{ minHeight: 48, fontWeight: hall.value === (selectedHall?.id ?? '') ? 700 : 600 }}>
                      {hall.label}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            ) : (
              <PosSectionTabs value={selectedHall?.id ?? ''} items={hallTabs} onChange={setSelectedHallId} scrollable />
            )}
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
              <PosIconAction icon="solar:lock-password-bold-duotone" onClick={() => void navigate('/lock-screen')} />
            ) : null}
          </Stack>
        </Stack>
      }>
      <Box
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '28px',
          backgroundColor: theme.palette.mode === 'dark' ? '#1f2124' : alpha('#ffffff', 0.78),
          border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.03 : 0.34)}`,
          px: { xs: 1.9, md: 2.6 },
          py: { xs: 1.9, md: 2.45 },
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.02)'
              : '0 18px 40px rgba(65, 46, 24, 0.08)',
        })}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.8}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          sx={{ mb: 3, flexShrink: 0 }}>
          <Typography variant="h4">{selectedHall?.name ?? copy.halls}</Typography>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="flex-end">
            {legendItems.map((item) => (
              <PosLegendPill
                key={item.key}
                label={isMobile ? item.label : `${item.label} (${item.count})`}
                color={item.color}
              />
            ))}
          </Stack>
        </Stack>

        {zoneTabs.length ? (
          <Box sx={{ mb: 2.5, flexShrink: 0 }}>
            <PosSectionTabs value={selectedZoneId} items={zoneTabs} onChange={setSelectedZoneId} scrollable />
          </Box>
        ) : null}

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pb: 1 }}>
          <Box
            data-testid="hall-layout-grid"
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumns}, minmax(${HALL_GRID_MIN_CELL_WIDTH}px, 1fr))`,
              gridAutoRows: `${HALL_GRID_ROW_HEIGHT}px`,
              gap: { xs: 1.5, md: 1.7 },
              minWidth: gridColumns * HALL_GRID_MIN_CELL_WIDTH,
              minHeight: gridRows * HALL_GRID_ROW_HEIGHT,
              alignItems: 'stretch',
            }}>
            {visibleTables
              .slice()
              .sort((leftTable, rightTable) => leftTable.tableNumber - rightTable.tableNumber)
              .map((table) => {
                const placement = getTableGridPlacement(table, gridColumns);
                return (
                  <Box
                    key={table.id}
                    sx={{
                      gridColumn: `${placement.positionX + 1} / span ${placement.width}`,
                      gridRow: `${placement.positionY + 1} / span ${placement.height}`,
                    }}>
                    <HallTableCard copy={copy} table={table} onSelect={handleTableSelect} />
                  </Box>
                );
              })}
          </Box>
        </Box>
      </Box>

      <Dialog open={Boolean(selectedTable)} onClose={() => setSelectedTable(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{copy.openTable}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body1" color="text.secondary">
              {selectedTable?.name}
            </Typography>
            <TextField
              label={copy.guestCount}
              type="number"
              inputProps={{ min: 1, max: selectedTableGuestLimit }}
              value={guestCount}
              onChange={(event) =>
                setGuestCount(Math.max(1, Math.min(Math.trunc(Number(event.target.value)) || 1, selectedTableGuestLimit)))
              }
            />
            {selectedTable?.activeSessions?.length ? (
              <Stack spacing={1}>
                {selectedTable.activeSessions.map((activeSession, index) => (
                  <Button
                    key={activeSession.id}
                    variant="outlined"
                    onClick={() => {
                      setSelectedTable(null);
                      void navigate(`/waiter/table-session?sessionId=${activeSession.id}`);
                    }}>
                    {copy.openTable} #{index + 1}
                  </Button>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setSelectedTable(null)}
            sx={(theme) => ({
              backgroundImage: 'none',
              backgroundColor: theme.palette.mode === 'dark' ? '#454545' : '#d6cebf',
              color: theme.palette.mode === 'dark' ? '#f5f5f5' : theme.palette.text.primary,
            })}>
            {copy.close}
          </Button>
          {canReserveTables && !selectedTable?.activeSession && selectedTable?.status !== 'reserved' ? (
            <Button
              variant="contained"
              onClick={() => reserveTableMutation.mutate()}
              disabled={reserveTableMutation.isPending || openSessionMutation.isPending}
              sx={(theme) => ({
                backgroundImage: 'none',
                backgroundColor: theme.palette.mode === 'dark' ? '#7a6126' : '#d5a53d',
                color: '#ffffff',
              })}>
              {copy.reserveTable}
            </Button>
          ) : null}
          {selectedTable &&
          selectedTableGuestLimit > 0 &&
          (selectedTable.status === 'reserved' ? canReserveTables : canManageTables) ? (
            <Button
              variant="contained"
              onClick={() => openSessionMutation.mutate()}
              disabled={openSessionMutation.isPending || reserveTableMutation.isPending}>
              {copy.openTable}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onLock={isMobile ? () => void navigate('/lock-screen') : undefined}
        onThemeToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        onSignOut={() => {
          setSession(null);
          void navigate('/pin-login', { replace: true });
        }}
        themeMode={themeMode}
      />
    </PosPageFrame>
  );
}
