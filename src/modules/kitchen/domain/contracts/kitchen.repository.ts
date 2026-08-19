import type {
  KitchenItemStatus,
  KitchenMonitorQueue,
  KitchenTicket,
  KitchenTicketStatus,
  TvMonitorBootstrapResult,
  TvMonitorDiagnostic,
  TvMonitorPairingSession,
  TvMonitorPairingStatus,
} from '../index';

export interface KitchenRepository {
  getQueue(): Promise<KitchenTicket[]>;
  getMonitorQueue(restaurantId: string): Promise<KitchenMonitorQueue>;
  bootstrapTvMonitor(): Promise<TvMonitorBootstrapResult>;
  createTvMonitorPairing(): Promise<TvMonitorPairingSession>;
  getTvMonitorPairingStatus(pairingId: string, pollToken: string): Promise<TvMonitorPairingStatus>;
  getTvMonitorQueue(): Promise<KitchenMonitorQueue>;
  reportTvMonitorDiagnostic(diagnostic: TvMonitorDiagnostic): Promise<void>;
  forgetTvMonitorDevice(): Promise<void>;
  replayTicketAnnouncement(ticketId: string): Promise<void>;
  updateTicketStatus(ticketId: string, status: KitchenTicketStatus): Promise<void>;
  updateItemStatus(itemId: string, status: KitchenItemStatus): Promise<void>;
}
