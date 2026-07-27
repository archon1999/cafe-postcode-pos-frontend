import type {
  KitchenItemStatus,
  KitchenMonitorQueue,
  KitchenTicket,
  KitchenTicketStatus,
  TvMonitorPairingClaimResult,
  TvMonitorDiagnostic,
  TvMonitorPairingSession,
  TvMonitorPairingStatus,
} from '../index';

export interface KitchenRepository {
  getQueue(): Promise<KitchenTicket[]>;
  getMonitorQueue(restaurantId: string): Promise<KitchenMonitorQueue>;
  createTvMonitorPairing(): Promise<TvMonitorPairingSession>;
  getTvMonitorPairingStatus(pairingId: string, pollToken: string): Promise<TvMonitorPairingStatus>;
  claimTvMonitorPairing(pairingId: string, claimToken: string): Promise<TvMonitorPairingClaimResult>;
  getTvMonitorQueue(token: string): Promise<KitchenMonitorQueue>;
  reportTvMonitorDiagnostic(token: string, diagnostic: TvMonitorDiagnostic): Promise<void>;
  updateTicketStatus(ticketId: string, status: KitchenTicketStatus): Promise<void>;
  updateItemStatus(itemId: string, status: KitchenItemStatus): Promise<void>;
}
