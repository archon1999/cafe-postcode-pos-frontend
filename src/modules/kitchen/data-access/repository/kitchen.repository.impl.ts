import type {
  KitchenItemStatus,
  KitchenMonitorQueue,
  KitchenRepository,
  KitchenTicket,
  KitchenTicketStatus,
  TvMonitorPairingClaimResult,
  TvMonitorDiagnostic,
  TvMonitorPairingSession,
  TvMonitorPairingStatus,
} from 'modules/kitchen/domain';
import {
  apiGet,
  apiGetRemotePublic,
  apiPost,
  apiPostRemote,
  apiPostRemotePublic,
  unwrapCollection,
} from 'shared/api/client';

import { mapKitchenMonitorQueue, mapKitchenTickets } from '../mappers';

type CollectionPayload<T> = T[] | { data?: T[] };

class KitchenRepositoryImpl implements KitchenRepository {
  async getQueue(): Promise<KitchenTicket[]> {
    return mapKitchenTickets(unwrapCollection(await apiGet<CollectionPayload<KitchenTicket>>('/pos/kitchen/queue/')));
  }

  async getMonitorQueue(restaurantId: string): Promise<KitchenMonitorQueue> {
    const params = new URLSearchParams({ restaurant_id: restaurantId });
    return mapKitchenMonitorQueue(await apiGet<KitchenMonitorQueue>(`/pos/monitor/kitchen-queue/?${params}`));
  }

  async createTvMonitorPairing(): Promise<TvMonitorPairingSession> {
    return apiPostRemotePublic<TvMonitorPairingSession>('/pos/monitor/tv-pairings/', {});
  }

  async getTvMonitorPairingStatus(pairingId: string, pollToken: string): Promise<TvMonitorPairingStatus> {
    return apiGetRemotePublic<TvMonitorPairingStatus>(`/pos/monitor/tv-pairings/${pairingId}/`, {
      headers: { 'X-TV-Pairing-Token': pollToken },
    });
  }

  async claimTvMonitorPairing(pairingId: string, claimToken: string): Promise<TvMonitorPairingClaimResult> {
    return apiPostRemote<TvMonitorPairingClaimResult>(`/pos/monitor/tv-pairings/${pairingId}/claim/`, { claimToken });
  }

  async getTvMonitorQueue(token: string): Promise<KitchenMonitorQueue> {
    return mapKitchenMonitorQueue(
      await apiGetRemotePublic<KitchenMonitorQueue>('/pos/monitor/tv-kitchen-queue/', {
        headers: { 'X-TV-Token': token },
      }),
    );
  }

  async reportTvMonitorDiagnostic(token: string, diagnostic: TvMonitorDiagnostic): Promise<void> {
    await apiPostRemotePublic('/pos/monitor/tv-diagnostics/', diagnostic, {
      headers: { 'X-TV-Token': token },
    });
  }

  async updateTicketStatus(ticketId: string, status: KitchenTicketStatus) {
    await apiPost(`/pos/kitchen/tickets/${ticketId}/status/`, { status });
  }

  async updateItemStatus(itemId: string, status: KitchenItemStatus) {
    await apiPost(`/pos/kitchen/items/${itemId}/status/`, { status });
  }
}

export const kitchenRepository: KitchenRepository = new KitchenRepositoryImpl();
