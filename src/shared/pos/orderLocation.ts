export type PosOrderLocation = {
  hallName?: string | null;
  showZoneName?: boolean;
  tableName?: string | null;
  tableNumber?: number | string | null;
  zoneName?: string | null;
};

function nonEmpty(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function getPosTableNumberLabel(location?: PosOrderLocation) {
  const tableNumber = nonEmpty(location?.tableNumber);
  if (tableNumber) return tableNumber;
  return location?.tableName?.match(/\d+/)?.[0] ?? '0';
}

export function getPosZoneContextLabel(location?: PosOrderLocation) {
  if (!location?.showZoneName) return '';
  return nonEmpty(location.zoneName) ?? '';
}

export function getPosOrderLocationLabel(
  location?: PosOrderLocation,
  options: { includeTable?: boolean; separator?: string } = {},
) {
  const values = [
    getPosZoneContextLabel(location),
    nonEmpty(location?.hallName),
    options.includeTable ? nonEmpty(location?.tableName) : null,
  ].filter((value): value is string => Boolean(value));
  const uniqueValues = values.filter(
    (value, index) =>
      values.findIndex((candidate) => candidate.toLocaleLowerCase() === value.toLocaleLowerCase()) === index,
  );
  return uniqueValues.join(options.separator ?? ' · ');
}
