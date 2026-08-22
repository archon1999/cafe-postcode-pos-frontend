import { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { canAccessTableSessionMenu, canAccessTakeawayBuilder, getPosHomePath, usePosSession } from 'modules/auth';
import { cashierKeys, useCashierBuilderOrdersQuery, useCashierMenuQuery } from 'modules/cashier/application';
import { cashierRepository } from 'modules/cashier/data-access';
import {
  getCurrentCashierBuilderOrder,
  type CashierBuilderOrderChannel,
  type CashierMenuCategory,
  type CashierMenuItem,
  type CashierOrderItem,
} from 'modules/cashier/domain';
import {
  useCurrentWaiterOrder,
  useWaiterMenuQuery,
  useWaiterTableSessionQuery,
  waiterKeys,
} from 'modules/waiter/application';
import { waiterRepository } from 'modules/waiter/data-access';
import type { WaiterMenuCategory, WaiterMenuItem, WaiterOrderItem } from 'modules/waiter/domain';
import { getPosCopy } from 'shared/locale/copy';
import { useOptimisticBuilderOrder } from 'shared/pos/useOptimisticBuilderOrder';

import {
  type CatalogCategoryLike,
  PriceHiddenCatalogContent,
  resolveBuilderChannel,
} from './PriceHiddenCatalogContent';

function WaiterMenuCatalogPage({ sessionId }: { sessionId: string | null }) {
  const { locale, session } = usePosSession();
  const canViewMenu = canAccessTableSessionMenu(session?.user);
  const menuQuery = useWaiterMenuQuery({ enabled: canViewMenu && Boolean(sessionId) });
  const orderQuery = useCurrentWaiterOrder(sessionId);
  const tableSessionQuery = useWaiterTableSessionQuery(sessionId);
  const copy = getPosCopy(locale);
  const { currentOrder, addItem, addItems, removeItem, hasPendingOperations } = useOptimisticBuilderOrder<
    WaiterMenuItem,
    WaiterOrderItem,
    NonNullable<typeof orderQuery.currentOrder>,
    Awaited<ReturnType<typeof waiterRepository.getOrders>>
  >({
    baseOrder: orderQuery.currentOrder,
    canonicalQueryKey: waiterKeys.orders,
    canonicalQueryFn: () => waiterRepository.getOrders(),
    channel: 'hall',
    createOrder: async () => {
      const response = await waiterRepository.createOrder(sessionId as string, '');
      return response.id;
    },
    defaultServiceFeeEnabled: Boolean(tableSessionQuery.data?.serviceFeeComponents?.length),
    defaultServiceFeePercent: Number(tableSessionQuery.data?.serviceFeePercent ?? 0),
    defaultServiceFeeComponents: tableSessionQuery.data?.serviceFeeComponents,
    defaultVatEnabled: Boolean(session?.restaurantContext?.vatEnabled),
    defaultVatPercent: session?.restaurantContext?.vatPercent ?? 0,
    removeOrderItem: (itemId) => waiterRepository.removeOrderItem(itemId),
    selectCurrentOrder: (orders) =>
      orders.find((order) => order.tableSession === sessionId && !['closed', 'cancelled'].includes(order.status)),
    addOrderItem: (orderId, menuItem, note, selectedModifiers) =>
      waiterRepository.addOrderItem(orderId, menuItem.id, note, selectedModifiers),
    addOrderItems: (orderId, items) =>
      waiterRepository.addOrderItems(
        orderId,
        items.map((item) => ({
          catalogItemId: item.menuItem.id,
          quantity: item.quantity,
          note: item.note,
          selectedModifiers: item.selectedModifiers,
        })),
      ),
    syncErrorMessage: copy.itemSyncFailed,
  });

  if (!sessionId || !canViewMenu) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return (
    <PriceHiddenCatalogContent
      categories={(menuQuery.data ?? []) as Array<WaiterMenuCategory & CatalogCategoryLike<WaiterMenuItem>>}
      orderItems={currentOrder?.items}
      isLoading={menuQuery.isLoading && !menuQuery.data}
      hasPendingOperations={hasPendingOperations}
      returnPath={`/waiter/table-session?sessionId=${encodeURIComponent(sessionId)}`}
      addItem={addItem}
      addItems={addItems}
      removeItem={removeItem}
    />
  );
}

function CashierMenuCatalogPage({ channel }: { channel: CashierBuilderOrderChannel }) {
  const { locale, session } = usePosSession();
  const canViewMenu = canAccessTakeawayBuilder(session?.user);
  const menuQuery = useCashierMenuQuery();
  const ordersQuery = useCashierBuilderOrdersQuery();
  const serverOrder = useMemo(
    () => getCurrentCashierBuilderOrder(ordersQuery.data, session?.user.id),
    [ordersQuery.data, session?.user.id],
  );
  const copy = getPosCopy(locale);
  const { currentOrder, addItem, addItems, removeItem, hasPendingOperations } = useOptimisticBuilderOrder({
    baseOrder: serverOrder,
    canonicalQueryKey: cashierKeys.builderOrders,
    canonicalQueryFn: () => cashierRepository.getOpenOrders(),
    channel,
    createOrder: async () => {
      const response = await cashierRepository.createBuilderOrder({ channel, note: '' });
      return response.id;
    },
    defaultServiceFeeEnabled: Boolean(session?.restaurantContext?.serviceFeeEnabled),
    defaultServiceFeePercent: Number(session?.restaurantContext?.serviceFeePercent ?? 0),
    defaultVatEnabled: Boolean(session?.restaurantContext?.vatEnabled),
    defaultVatPercent: session?.restaurantContext?.vatPercent ?? 0,
    removeOrderItem: (itemId) => cashierRepository.removeOrderItem(itemId),
    resetKey: channel,
    selectCurrentOrder: (orders) => getCurrentCashierBuilderOrder(orders, session?.user.id),
    addOrderItem: (orderId, menuItem, note, selectedModifiers) =>
      cashierRepository.addOrderItem(orderId, menuItem.id, note, selectedModifiers),
    addOrderItems: (orderId, items) =>
      cashierRepository.addOrderItems(
        orderId,
        items.map((item) => ({
          catalogItemId: item.menuItem.id,
          quantity: item.quantity,
          note: item.note,
          selectedModifiers: item.selectedModifiers,
        })),
      ),
    syncErrorMessage: copy.itemSyncFailed,
  });

  if (!canViewMenu) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return (
    <PriceHiddenCatalogContent
      categories={(menuQuery.data ?? []) as Array<CashierMenuCategory & CatalogCategoryLike<CashierMenuItem>>}
      orderItems={currentOrder?.items as CashierOrderItem[] | undefined}
      isLoading={(menuQuery.isLoading && !menuQuery.data) || (ordersQuery.isLoading && !ordersQuery.data)}
      hasPendingOperations={hasPendingOperations}
      returnPath={`/cashier/builder?channel=${channel}`}
      addItem={addItem}
      addItems={addItems}
      removeItem={removeItem}
    />
  );
}

export function MenuCatalogPage() {
  const [searchParams] = useSearchParams();
  const { session } = usePosSession();
  const source = searchParams.get('source');

  if (source === 'waiter') {
    return <WaiterMenuCatalogPage sessionId={searchParams.get('sessionId')} />;
  }

  if (source === 'cashier') {
    return <CashierMenuCatalogPage channel={resolveBuilderChannel(searchParams.get('channel'))} />;
  }

  return <Navigate to={getPosHomePath(session)} replace />;
}
