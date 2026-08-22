import { Icon } from '@iconify/react';
import { Button, Menu, MenuItem, Stack, alpha, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { canAccessWaiterTables, canManageTableReservations, usePosSession } from 'modules/auth';
import {
  useGroupTableSessionMutation,
  useOpenTableSessionMutation,
  useReserveTableMutation,
  useTransferTableSessionMutation,
  useUngroupTableSessionMutation,
  useWaiterHallsQuery,
} from 'modules/waiter/application';
import {
  type ActiveSession,
  type DiningTable,
  type Hall,
  clampGuestCount,
  getAvailableSeatCount,
  getSupportedSeatCount,
} from 'modules/waiter/domain';
import { getApiErrorMessage } from 'shared/api/errorMessage';
import { refreshTransportAndReload } from 'shared/api/transportResolver';
import { PosPageFrame } from 'shared/layout/PosPageFrame';
import { getPosCopy } from 'shared/locale/copy';
import { PosHallsPageSkeleton, PosIconAction, PosSectionTabs, PosSettingsMenu } from 'shared/ui/pos-primitives';

import { HallMapPanel } from './HallMapPanel';
import { formatFloorLabel } from './hallMapScale';
import { HallMapZoomControls } from './HallMapZoomControls';
import { OpenTableDialog } from './OpenTableDialog';
import { type TableOperationMode, type TableOperationSubmit, TableOperationsDialog } from './TableOperationsDialog';
import { useHallMapViewport } from './useHallMapViewport';
import { useHallsNavigation } from './useHallsNavigation';

const EMPTY_HALLS: Hall[] = [];

type ActiveTableOperation = {
  mode: TableOperationMode;
  sourceTable: DiningTable;
  sourceSession: ActiveSession;
};

export function HallsPageContent() {
  const navigate = useNavigate();
  const { session, locale, setLocale, setSession, themeColor, setThemeColor, themeMode, setThemeMode } =
    usePosSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const copy = getPosCopy(locale);
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [floorAnchor, setFloorAnchor] = useState<HTMLElement | null>(null);
  const [hallAnchor, setHallAnchor] = useState<HTMLElement | null>(null);
  const [tableOperation, setTableOperation] = useState<ActiveTableOperation | null>(null);

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
  const tableOperationMutationOptions = {
    onSuccess: () => {
      setTableOperation(null);
      setSelectedTable(null);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, copy.tableOperationFailed)),
  };
  const transferTableMutation = useTransferTableSessionMutation(tableOperationMutationOptions);
  const groupTablesMutation = useGroupTableSessionMutation(tableOperationMutationOptions);
  const ungroupTablesMutation = useUngroupTableSessionMutation(tableOperationMutationOptions);
  const canManageTables = canAccessWaiterTables(session?.user);
  const canReserveTables = canManageTableReservations(session?.user);
  const selectedTableAvailableSeats = selectedTable ? getAvailableSeatCount(selectedTable) : 0;
  const selectedTableGuestLimit = selectedTable
    ? Math.max(
        1,
        Math.min(
          getSupportedSeatCount(selectedTable.seatCount),
          selectedTableAvailableSeats || selectedTable.seatCount,
        ),
      )
    : 4;

  const halls = hallsQuery.data ?? EMPTY_HALLS;
  const isInitialLoading = hallsQuery.isLoading && !hallsQuery.data;
  const navigation = useHallsNavigation(halls, locale, copy);
  const {
    activeLevel,
    availableLevels,
    floorTabs,
    gridColumns,
    hallTabs,
    legendItems,
    selectedHall,
    selectedZoneId,
    setSelectedHallId,
    setSelectedLevel,
    setSelectedZoneId,
    visibleTables,
    zoneTabs,
  } = navigation;
  const {
    contentHeight: mapContentHeight,
    contentWidth: mapContentWidth,
    layoutBounds: tableLayoutBounds,
    mapScale,
    mapScaleMode,
    scaledHeight: scaledMapHeight,
    scaledWidth: scaledMapWidth,
    toggleFitFill: handleMapFitFillToggle,
    viewportRef: mapViewportRef,
    viewportSize: mapViewportSize,
    zoom: handleMapZoom,
  } = useHallMapViewport({
    gridColumns,
    isLoading: isInitialLoading,
    selectedHallKey: selectedHall?.id,
    selectedZoneId,
    tables: visibleTables,
  });

  const mapZoomControls = (
    <HallMapZoomControls
      scale={mapScale}
      scaleMode={mapScaleMode}
      onFitFillToggle={handleMapFitFillToggle}
      onZoom={handleMapZoom}
    />
  );

  const handleTableSelect = (currentTable: DiningTable) => {
    if (currentTable.activeSession) {
      if (!canManageTables) {
        return;
      }

      const availableSeats = getAvailableSeatCount(currentTable);
      if (availableSeats > 0) {
        const nextGuestCount = Math.max(1, Math.min(getSupportedSeatCount(currentTable.seatCount), availableSeats));
        setGuestCount(nextGuestCount);
        setSelectedTable(currentTable);
        return;
      }

      setSelectedTable(currentTable);
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

  const openTableOperation = (mode: TableOperationMode, sourceSession: ActiveSession) => {
    if (!selectedTable) return;
    setTableOperation({ mode, sourceTable: selectedTable, sourceSession });
    setSelectedTable(null);
  };

  const handleTableOperationConfirm = (operation: TableOperationSubmit) => {
    if (!tableOperation) return;
    const sessionId = tableOperation.sourceSession.id;
    if (operation.mode === 'transfer') {
      transferTableMutation.mutate({
        sessionId,
        targetTableId: operation.targetTable.id,
        expectedTargetSessionIds: (operation.targetTable.activeSessions ?? []).map((item) => item.id),
        targetSessionId: operation.targetSessionId,
      });
      return;
    }
    if (operation.mode === 'group') {
      groupTablesMutation.mutate({ sessionId, tableIds: operation.tableIds });
      return;
    }
    ungroupTablesMutation.mutate({ sessionId, tableIds: operation.tableIds });
  };

  const tableOperationPending =
    transferTableMutation.isPending || groupTablesMutation.isPending || ungroupTablesMutation.isPending;

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
            {mapZoomControls}
            {!isMobile ? (
              <PosIconAction icon="solar:refresh-bold-duotone" onClick={() => void refreshTransportAndReload()} />
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
      <HallMapPanel
        title={selectedHall?.name ?? copy.halls}
        copy={copy}
        isMobile={isMobile}
        legendItems={legendItems}
        zoneTabs={zoneTabs}
        selectedZoneId={selectedZoneId}
        onZoneChange={setSelectedZoneId}
        viewportRef={mapViewportRef}
        viewportSize={mapViewportSize}
        scaledWidth={scaledMapWidth}
        scaledHeight={scaledMapHeight}
        layoutBounds={tableLayoutBounds}
        contentWidth={mapContentWidth}
        contentHeight={mapContentHeight}
        mapScale={mapScale}
        tables={visibleTables}
        gridColumns={gridColumns}
        onTableSelect={handleTableSelect}
      />

      <OpenTableDialog
        table={selectedTable}
        guestCount={guestCount}
        guestLimit={selectedTableGuestLimit}
        canManageTables={canManageTables}
        canReserveTables={canReserveTables}
        opening={openSessionMutation.isPending}
        reserving={reserveTableMutation.isPending}
        copy={copy}
        onGuestCountChange={setGuestCount}
        onClose={() => setSelectedTable(null)}
        onOpen={() => openSessionMutation.mutate()}
        onReserve={() => reserveTableMutation.mutate()}
        onOpenSession={(sessionId) => {
          setSelectedTable(null);
          void navigate(`/waiter/table-session?sessionId=${sessionId}`);
        }}
        onTransferSession={(activeSession) => openTableOperation('transfer', activeSession)}
        onGroupSession={(activeSession) => openTableOperation('group', activeSession)}
        onUngroupSession={(activeSession) => openTableOperation('ungroup', activeSession)}
      />

      <TableOperationsDialog
        open={Boolean(tableOperation)}
        mode={tableOperation?.mode ?? 'transfer'}
        sourceTable={tableOperation?.sourceTable ?? null}
        sourceSession={tableOperation?.sourceSession ?? null}
        halls={halls}
        copy={copy}
        pending={tableOperationPending}
        onClose={() => setTableOperation(null)}
        onConfirm={handleTableOperationConfirm}
      />

      <PosSettingsMenu
        anchorEl={settingsAnchor}
        locale={locale}
        onClose={() => setSettingsAnchor(null)}
        onLocaleChange={setLocale}
        onRefresh={isMobile ? () => window.location.reload() : undefined}
        onLock={isMobile ? () => void navigate('/lock-screen') : undefined}
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
