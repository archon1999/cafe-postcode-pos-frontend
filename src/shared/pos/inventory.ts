import type { PosLocale } from 'shared/locale/copy';

export type PosInventoryAvailability = {
  tracked: boolean;
  blocked: boolean;
  lowStock: boolean;
  availableQuantity: string | number | null;
  reason: string;
  updatedAt: string | null;
};

export type InventoryDisposition = 'not_prepared' | 'waste' | 'returned';

export const inventoryCopy = {
  uz: {
    blocked: 'Ingredient yetarli emas',
    low: 'Qoldiq kamaygan',
    cancellation: 'Mahsulot bilan nima bo‘ldi?',
    notPrepared: 'Tayyorlanmadi — ingredientni qaytarish',
    waste: 'Tayyorlandi / sarflandi — qoldiqni qaytarmaslik',
    returned: 'Mahsulot amalda omborga qaytarildi',
    note: 'Pulni bekor qilishning o‘zi ingredientni omborga qaytarmaydi.',
    confirm: 'Bekor qilish',
    close: 'Ortga',
  },
  'uz-crl': {
    blocked: 'Ингредиент етарли эмас',
    low: 'Қолдиқ камайган',
    cancellation: 'Маҳсулот билан нима бўлди?',
    notPrepared: 'Тайёрланмади — ингредиентни қайтариш',
    waste: 'Тайёрланди / сарфланди — қолдиқни қайтармаслик',
    returned: 'Маҳсулот амалда омборга қайтарилди',
    note: 'Пулни бекор қилишнинг ўзи ингредиентни омборга қайтармайди.',
    confirm: 'Бекор қилиш',
    close: 'Ортга',
  },
  ru: {
    blocked: 'Недостаточно ингредиентов',
    low: 'Мало на складе',
    cancellation: 'Что произошло с продуктом?',
    notPrepared: 'Не готовили — вернуть ингредиенты',
    waste: 'Приготовили / израсходовали — не возвращать остаток',
    returned: 'Продукт фактически вернули на склад',
    note: 'Отмена оплаты сама по себе не возвращает ингредиенты на склад.',
    confirm: 'Отменить позицию',
    close: 'Назад',
  },
} satisfies Record<PosLocale, Record<string, string>>;

export function inventoryAvailabilityLabel(inventory: PosInventoryAvailability | null | undefined, locale: PosLocale) {
  if (inventory?.blocked) return inventoryCopy[locale].blocked;
  if (inventory?.lowStock) return inventoryCopy[locale].low;
  return '';
}
