import { useEffect, useMemo, useState } from 'react';

import { getHallGridColumns, getTableStatus, type Hall } from 'modules/waiter/domain';
import { getPosCopy } from 'shared/locale/copy';

import { formatFloorLabel, getAllZonesLabel } from './hallMapScale';

export function useHallsNavigation(halls: Hall[], locale: string, copy: ReturnType<typeof getPosCopy>) {
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedHallId, setSelectedHallId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('all');
  const availableLevels = useMemo(() => (halls.length ? [1] : []), [halls.length]);
  const activeLevel = selectedLevel || String(availableLevels[0] ?? 1);
  const floorTabs = useMemo(
    () => availableLevels.map((level) => ({ value: String(level), label: formatFloorLabel(locale, level) })),
    [availableLevels, locale],
  );
  const selectedHall = useMemo(() => {
    const defaultHall = halls[0];
    const hallId = selectedHallId || defaultHall?.id;
    return halls.find((hall) => hall.id === hallId) ?? defaultHall;
  }, [halls, selectedHallId]);
  const hallTabs = halls.map((hall) => ({ value: hall.id, label: hall.name }));
  const zoneTabs = useMemo(() => {
    const zones = (selectedHall?.zones ?? []).filter((zone) => zone.isActive !== false);
    if (!zones.length) return [];
    return [
      { value: 'all', label: getAllZonesLabel(locale) },
      ...zones.map((zone) => ({ value: zone.id, label: zone.name })),
    ];
  }, [locale, selectedHall?.zones]);
  const visibleTables = useMemo(() => {
    const tables = selectedHall?.tables ?? [];
    if (!selectedZoneId || selectedZoneId === 'all') return tables;
    return tables.filter((table) => table.zone === selectedZoneId);
  }, [selectedHall?.tables, selectedZoneId]);

  useEffect(() => {
    if (!zoneTabs.length) {
      if (selectedZoneId !== 'all') setSelectedZoneId('all');
      return;
    }
    if (!zoneTabs.some((zone) => zone.value === selectedZoneId)) setSelectedZoneId('all');
  }, [selectedZoneId, zoneTabs]);

  const hallStats = useMemo(() => {
    const stats = { available: 0, reserved: 0, occupied: 0, blocked: 0 };
    for (const table of visibleTables) stats[getTableStatus(table)] += 1;
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

  return {
    activeLevel,
    availableLevels,
    floorTabs,
    gridColumns: getHallGridColumns(selectedHall),
    hallTabs,
    legendItems,
    selectedHall,
    selectedHallId,
    selectedLevel,
    selectedZoneId,
    setSelectedHallId,
    setSelectedLevel,
    setSelectedZoneId,
    visibleTables,
    zoneTabs,
  };
}
