import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type DiningTable, getTableGridPlacement } from 'modules/waiter/domain';

import {
  HALL_GRID_GAP,
  HALL_GRID_MIN_CELL_WIDTH,
  HALL_GRID_ROW_HEIGHT,
  HALL_MAP_ZOOM_STEP,
  clampMapScale,
  readHallMapScaleSettings,
  writeHallMapScaleSettings,
} from './hallMapScale';

export function useHallMapViewport({
  gridColumns,
  isLoading,
  selectedHallKey,
  selectedZoneId,
  tables,
}: {
  gridColumns: number;
  isLoading: boolean;
  selectedHallKey: string | undefined;
  selectedZoneId: string;
  tables: DiningTable[];
}) {
  const [initialSettings] = useState(readHallMapScaleSettings);
  const [mapScale, setMapScale] = useState(initialSettings.scale);
  const [mapScaleMode, setMapScaleMode] = useState(initialSettings.mode);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const gridRows = useMemo(
    () =>
      tables.reduce((maxRows, table) => {
        const placement = getTableGridPlacement(table, gridColumns);
        return Math.max(maxRows, placement.positionY + placement.height);
      }, 1),
    [gridColumns, tables],
  );
  const layoutBounds = useMemo(() => {
    if (!tables.length) {
      return { minX: 0, minY: 0, columns: gridColumns, rows: gridRows };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = 0;
    let maxY = 0;
    for (const table of tables) {
      const placement = getTableGridPlacement(table, gridColumns);
      minX = Math.min(minX, placement.positionX);
      minY = Math.min(minY, placement.positionY);
      maxX = Math.max(maxX, placement.positionX + placement.width);
      maxY = Math.max(maxY, placement.positionY + placement.height);
    }
    return { minX, minY, columns: Math.max(1, maxX - minX), rows: Math.max(1, maxY - minY) };
  }, [gridColumns, gridRows, tables]);
  const contentWidth =
    layoutBounds.columns * HALL_GRID_MIN_CELL_WIDTH + Math.max(0, layoutBounds.columns - 1) * HALL_GRID_GAP;
  const contentHeight = layoutBounds.rows * HALL_GRID_ROW_HEIGHT + Math.max(0, layoutBounds.rows - 1) * HALL_GRID_GAP;
  const fitScale = useMemo(() => {
    if (!viewportSize.width || !viewportSize.height || !contentWidth || !contentHeight) {
      return 1;
    }
    return clampMapScale(
      Math.min(
        1,
        Math.max(1, viewportSize.width - 28) / contentWidth,
        Math.max(1, viewportSize.height - 28) / contentHeight,
      ),
    );
  }, [contentHeight, contentWidth, viewportSize.height, viewportSize.width]);
  const fillScale = useMemo(() => {
    if (!viewportSize.width || !contentWidth) {
      return 1;
    }
    return clampMapScale(Math.max(1, viewportSize.width - 28) / contentWidth);
  }, [contentWidth, viewportSize.width]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const updateViewportSize = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    updateViewportSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewportSize);
      return () => window.removeEventListener('resize', updateViewportSize);
    }
    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [isLoading, selectedHallKey, selectedZoneId]);

  useEffect(() => {
    if (mapScaleMode === 'fit') {
      setMapScale(fitScale);
    } else if (mapScaleMode === 'fill') {
      setMapScale(fillScale);
    }
  }, [fillScale, fitScale, mapScaleMode]);

  useEffect(() => {
    writeHallMapScaleSettings({ mode: mapScaleMode, scale: mapScale });
  }, [mapScale, mapScaleMode]);

  const toggleFitFill = useCallback(() => {
    setMapScaleMode((currentMode) => {
      const nextMode = currentMode === 'fill' ? 'fit' : 'fill';
      setMapScale(nextMode === 'fit' ? fitScale : fillScale);
      return nextMode;
    });
  }, [fillScale, fitScale]);
  const zoom = useCallback((direction: 1 | -1) => {
    setMapScaleMode('manual');
    setMapScale((currentScale) => clampMapScale(Number((currentScale + direction * HALL_MAP_ZOOM_STEP).toFixed(2))));
  }, []);

  return {
    contentHeight,
    contentWidth,
    layoutBounds,
    mapScale,
    mapScaleMode,
    scaledHeight: contentHeight * mapScale,
    scaledWidth: contentWidth * mapScale,
    toggleFitFill,
    viewportRef,
    zoom,
  };
}
