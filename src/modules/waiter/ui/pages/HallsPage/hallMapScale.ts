export const HALL_GRID_MIN_CELL_WIDTH = 126;
export const HALL_GRID_ROW_HEIGHT = 134;
export const HALL_GRID_GAP = 18;
export const HALL_MAP_MIN_SCALE = 0.45;
export const HALL_MAP_MAX_SCALE = 1.6;
export const HALL_MAP_ZOOM_STEP = 0.12;
export const HALL_MAP_STORAGE_KEY = 'pos.waiter.halls.mapScale';

export type HallMapScaleMode = 'fit' | 'fill' | 'manual';

export type HallMapScaleSettings = {
  mode: HallMapScaleMode;
  scale: number;
};

export function clampMapScale(value: number) {
  return Math.min(HALL_MAP_MAX_SCALE, Math.max(HALL_MAP_MIN_SCALE, value));
}

export function clampAutomaticMapScale(value: number) {
  return Number.isFinite(value) ? Math.max(HALL_MAP_MIN_SCALE, value) : 1;
}

export function calculateHallMapFillScale(viewportWidth: number, contentWidth: number) {
  if (!viewportWidth || !contentWidth) {
    return 1;
  }

  return clampAutomaticMapScale(Math.max(1, viewportWidth - 28) / contentWidth);
}

export function isHallMapScaleMode(value: unknown): value is HallMapScaleMode {
  return value === 'fit' || value === 'fill' || value === 'manual';
}

export function readHallMapScaleSettings(): HallMapScaleSettings {
  if (typeof window === 'undefined') {
    return { mode: 'manual', scale: 1 };
  }

  try {
    const rawSettings = window.localStorage.getItem(HALL_MAP_STORAGE_KEY);
    if (!rawSettings) {
      return { mode: 'manual', scale: 1 };
    }

    const parsedSettings = JSON.parse(rawSettings) as Partial<HallMapScaleSettings>;
    const parsedScale = Number(parsedSettings.scale);

    const mode = isHallMapScaleMode(parsedSettings.mode) ? parsedSettings.mode : 'manual';

    return {
      mode,
      scale: Number.isFinite(parsedScale)
        ? mode === 'manual'
          ? clampMapScale(parsedScale)
          : clampAutomaticMapScale(parsedScale)
        : 1,
    };
  } catch {
    return { mode: 'manual', scale: 1 };
  }
}

export function writeHallMapScaleSettings(settings: HallMapScaleSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(HALL_MAP_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures; zoom should still work for the current session.
  }
}

export function formatFloorLabel(locale: string, level: number) {
  if (locale === 'uz-crl') {
    return `${level}-Т›Р°РІР°С‚`;
  }

  if (locale === 'ru') {
    return `${level} СЌС‚Р°Р¶`;
  }

  return `${level}-qavat`;
}

export function getAllZonesLabel(locale: string) {
  if (locale === 'uz-crl') {
    return 'Р‘Р°СЂС‡Р°СЃРё';
  }

  if (locale === 'ru') {
    return 'Р’СЃРµ';
  }

  return 'Barchasi';
}
