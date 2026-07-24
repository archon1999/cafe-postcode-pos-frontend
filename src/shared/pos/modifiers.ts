export type PosModifierOption = {
  id: string;
  name: string;
  priceDelta: number | string;
  isDefault?: boolean;
  sortOrder?: number;
};

export type PosModifierGroup = {
  id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  sortOrder?: number;
  options: PosModifierOption[];
};

export type PosModifierSelection = {
  group: string;
  options: string[];
};

export type PosOrderItemModifier = {
  id?: string;
  optionId?: string | null;
  groupId?: string | null;
  groupName: string;
  optionName: string;
  priceDelta: number | string;
  sortOrder?: number;
};

type ModifierOptionDto = {
  id?: string;
  name?: string;
  priceDelta?: number | string;
  isDefault?: boolean;
  sortOrder?: number;
  price_delta?: number | string;
  is_default?: boolean;
  sort_order?: number;
};

type ModifierGroupDto = {
  id?: string;
  name?: string;
  selectionType?: 'single' | 'multiple';
  minSelections?: number;
  maxSelections?: number;
  sortOrder?: number;
  selection_type?: 'single' | 'multiple';
  min_selections?: number;
  max_selections?: number;
  sort_order?: number;
  options?: ModifierOptionDto[];
};

type OrderItemModifierDto = Partial<PosOrderItemModifier> & {
  modifier_option?: string | null;
  group_id?: string | null;
  group_name?: string;
  option_name?: string;
  price_delta?: number | string;
  sort_order?: number;
};

export function mapPosModifierGroups(groups: ModifierGroupDto[] | undefined): PosModifierGroup[] {
  return (groups ?? []).map((group) => ({
    id: group.id ?? '',
    name: group.name ?? '',
    selectionType: group.selectionType ?? group.selection_type ?? 'single',
    minSelections: Number(group.minSelections ?? group.min_selections ?? 0),
    maxSelections: Number(group.maxSelections ?? group.max_selections ?? 1),
    sortOrder: group.sortOrder ?? group.sort_order,
    options: (group.options ?? []).map((option) => ({
      id: option.id ?? '',
      name: option.name ?? '',
      priceDelta: option.priceDelta ?? option.price_delta ?? 0,
      isDefault: option.isDefault ?? option.is_default ?? false,
      sortOrder: option.sortOrder ?? option.sort_order,
    })),
  }));
}

export function mapPosOrderItemModifiers(modifiers: OrderItemModifierDto[] | undefined): PosOrderItemModifier[] {
  return (modifiers ?? []).map((modifier) => ({
    id: modifier.id,
    optionId: modifier.optionId ?? modifier.modifier_option ?? null,
    groupId: modifier.groupId ?? modifier.group_id ?? null,
    groupName: modifier.groupName ?? modifier.group_name ?? '',
    optionName: modifier.optionName ?? modifier.option_name ?? '',
    priceDelta: modifier.priceDelta ?? modifier.price_delta ?? 0,
    sortOrder: modifier.sortOrder ?? modifier.sort_order,
  }));
}

export function defaultModifierSelections(groups: PosModifierGroup[]): PosModifierSelection[] {
  return groups.map((group) => ({
    group: group.id,
    options: group.options
      .filter((option) => option.isDefault)
      .slice(0, group.maxSelections)
      .map((option) => option.id),
  }));
}

export function modifierSelectionsValid(groups: PosModifierGroup[], selections: PosModifierSelection[]) {
  const selected = new Map(selections.map((selection) => [selection.group, selection.options]));
  return groups.every((group) => {
    const count = selected.get(group.id)?.length ?? 0;
    return count >= group.minSelections && count <= group.maxSelections;
  });
}

export function selectedModifierOptions(groups: PosModifierGroup[], selections: PosModifierSelection[]) {
  const selected = new Map(selections.map((selection) => [selection.group, new Set(selection.options)]));
  return groups.flatMap((group) =>
    group.options.filter((option) => selected.get(group.id)?.has(option.id)).map((option) => ({ group, option })),
  );
}

export function modifierPriceDelta(groups: PosModifierGroup[], selections: PosModifierSelection[]) {
  return selectedModifierOptions(groups, selections).reduce(
    (total, item) => total + Number(item.option.priceDelta || 0),
    0,
  );
}

export function orderItemModifierSignature(modifiers: PosOrderItemModifier[] | undefined) {
  return (modifiers ?? [])
    .map(
      (modifier) =>
        `${modifier.optionId ?? ''}:${modifier.groupName}:${modifier.optionName}:${Number(modifier.priceDelta || 0)}`,
    )
    .sort()
    .join('|');
}

export function selectionsFromOrderModifiers(
  groups: PosModifierGroup[],
  modifiers: PosOrderItemModifier[] | undefined,
): PosModifierSelection[] {
  const optionIds = new Set((modifiers ?? []).map((modifier) => modifier.optionId).filter(Boolean));
  return groups.map((group) => ({
    group: group.id,
    options: group.options.filter((option) => optionIds.has(option.id)).map((option) => option.id),
  }));
}

export function selectionPayloadFromOrderModifiers(
  modifiers: PosOrderItemModifier[] | undefined,
): PosModifierSelection[] {
  const grouped = new Map<string, string[]>();
  for (const modifier of modifiers ?? []) {
    if (!modifier.groupId || !modifier.optionId) continue;
    grouped.set(modifier.groupId, [...(grouped.get(modifier.groupId) ?? []), modifier.optionId]);
  }
  return Array.from(grouped, ([group, options]) => ({ group, options }));
}
