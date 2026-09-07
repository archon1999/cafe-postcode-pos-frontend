import { useMemo } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

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
import { useInventoryCancellation } from 'shared/ui/pos-primitives/useInventoryCancellation';

import {
  type CatalogCategoryLike,
  PriceHiddenCatalogContent,
  resolveBuilderChannel,
} from './PriceHiddenCatalogContent';

function WaiterMenuCatalogPage({ sessionId }: { sessionId: string | null }) {
  const navigate = useNavigate();
  const { locale, session } = usePosSession();
  const canViewMenu = canAccessTableSessionMenu(session?.user);
  const menuQuery = useWaiterMenuQuery({ enabled: canViewMenu && Boolean(sessionId) });
  const orderQuery = useCurrentWaiterOrder(sessionId);
  const tableSessionQuery = useWaiterTableSessionQuery(sessionId);
  const copy = getPosCopy(locale);
  const {
    currentOrder,
    addItem,
    addItems,
    removeItem: removeItemDirect,
    hasPendingOperations,
  } = useOptimisticBuilderOrder<
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
    defaultServiceFeeStartedAt: tableSessionQuery.data?.openedAt,
    defaultVatEnabled: Boolean(session?.restaurantContext?.vatEnabled),
    defaultVatPercent: session?.restaurantContext?.vatPercent ?? 0,
    removeOrderItem: (itemId, disposition) => waiterRepository.removeOrderItem(itemId, disposition),
    onOrderRemoved: (removedOrder) => {
      if (removedOrder && removedOrder.status !== 'open') {
        void navigate('/waiter/halls', { replace: true });
      }
    },
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
  const { removeItem, inventoryCancellationDialog } = useInventoryCancellation(
    currentOrder?.items,
    removeItemDirect,
    locale,
  );

  if (!sessionId || !canViewMenu) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  if (
    tableSessionQuery.data === null ||
    tableSessionQuery.data?.status === 'closed' ||
    tableSessionQuery.data?.status === 'merged'
  ) {
    return <Navigate to="/waiter/halls" replace />;
  }

  return (
    <>
      {inventoryCancellationDialog}
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
    </>
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
  const {
    currentOrder,
    addItem,
    addItems,
    removeItem: removeItemDirect,
    hasPendingOperations,
  } = useOptimisticBuilderOrder({
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
    removeOrderItem: (itemId, disposition) => cashierRepository.removeOrderItem(itemId, disposition),
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
  const { removeItem, inventoryCancellationDialog } = useInventoryCancellation(
    currentOrder?.items,
    removeItemDirect,
    locale,
  );

  if (!canViewMenu) {
    return <Navigate to={getPosHomePath(session)} replace />;
  }

  return (
    <>
      {inventoryCancellationDialog}
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
    </>
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
