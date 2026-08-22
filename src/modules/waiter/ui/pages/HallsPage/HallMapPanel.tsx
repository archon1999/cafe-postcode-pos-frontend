import { Box, Stack, Typography, alpha } from '@mui/material';
import type { RefObject } from 'react';

import { getTableGridPlacement, type DiningTable } from 'modules/waiter/domain';
import type { getPosCopy } from 'shared/locale/copy';
import { PosLegendPill, PosSectionTabs } from 'shared/ui/pos-primitives';

import { HALL_GRID_GAP, HALL_GRID_MIN_CELL_WIDTH, HALL_GRID_ROW_HEIGHT } from './hallMapScale';
import { HallTableCard } from './HallTableCard';

type Tab = { value: string; label: string };
type LegendItem = { key: string; label: string; count: number; color: string };
type LayoutBounds = { minX: number; minY: number; columns: number; rows: number };

type Props = {
  title: string;
  copy: ReturnType<typeof getPosCopy>;
  isMobile: boolean;
  legendItems: LegendItem[];
  zoneTabs: Tab[];
  selectedZoneId: string;
  onZoneChange: (zoneId: string) => void;
  viewportRef: RefObject<HTMLDivElement | null>;
  viewportSize: { width: number; height: number };
  scaledWidth: number;
  scaledHeight: number;
  layoutBounds: LayoutBounds;
  contentWidth: number;
  contentHeight: number;
  mapScale: number;
  tables: DiningTable[];
  gridColumns: number;
  onTableSelect: (table: DiningTable) => void;
  onTableActions?: (table: DiningTable, anchorEl: HTMLElement) => void;
};

export function HallMapPanel({
  title,
  copy,
  isMobile,
  legendItems,
  zoneTabs,
  selectedZoneId,
  onZoneChange,
  viewportRef,
  viewportSize,
  scaledWidth,
  scaledHeight,
  layoutBounds,
  contentWidth,
  contentHeight,
  mapScale,
  tables,
  gridColumns,
  onTableSelect,
  onTableActions,
}: Props) {
  return (
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
        mb: 2,
        boxShadow:
          theme.palette.mode === 'dark' ? 'inset 0 1px 0 rgba(255,255,255,0.02)' : '0 18px 40px rgba(65, 46, 24, 0.08)',
      })}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.8}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', lg: 'center' }}
        sx={{ mb: 3, flexShrink: 0 }}>
        <Typography variant="h4">{title}</Typography>
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
          <PosSectionTabs value={selectedZoneId} items={zoneTabs} onChange={onZoneChange} scrollable />
        </Box>
      ) : null}

      <Box
        ref={viewportRef}
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          pb: 1,
          position: 'relative',
          borderRadius: '20px',
          backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.015) : alpha('#fffdf8', 0.42),
          scrollbarWidth: 'thin',
        })}>
        <Box
          sx={{
            minWidth: '100%',
            minHeight: '100%',
            display: 'flex',
            justifyContent: scaledWidth <= viewportSize.width ? 'center' : 'flex-start',
            alignItems: scaledHeight <= viewportSize.height ? 'center' : 'flex-start',
            p: 1.25,
          }}>
          <Box sx={{ width: scaledWidth, height: scaledHeight, flex: '0 0 auto' }}>
            <Box
              data-testid="hall-layout-grid"
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${layoutBounds.columns}, ${HALL_GRID_MIN_CELL_WIDTH}px)`,
                gridAutoRows: `${HALL_GRID_ROW_HEIGHT}px`,
                gap: `${HALL_GRID_GAP}px`,
                width: contentWidth,
                height: contentHeight,
                alignItems: 'stretch',
                transform: `scale(${mapScale})`,
                transformOrigin: 'top left',
                transition: 'transform 160ms ease',
              }}>
              {tables
                .slice()
                .sort((leftTable, rightTable) => leftTable.tableNumber - rightTable.tableNumber)
                .map((table) => {
                  const placement = getTableGridPlacement(table, gridColumns);
                  return (
                    <Box
                      key={table.id}
                      sx={{
                        gridColumn: `${placement.positionX - layoutBounds.minX + 1} / span ${placement.width}`,
                        gridRow: `${placement.positionY - layoutBounds.minY + 1} / span ${placement.height}`,
                      }}>
                      <HallTableCard
                        copy={copy}
                        table={table}
                        onSelect={onTableSelect}
                        onOpenActions={onTableActions}
                      />
                    </Box>
                  );
                })}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
