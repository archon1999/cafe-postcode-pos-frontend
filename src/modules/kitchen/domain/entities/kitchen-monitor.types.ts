import type { KitchenTicketStatus } from '../enums';

export type KitchenMonitorTicket = {
  id: string;
  orderId?: string;
  orderNumber: number;
  displayName?: string | null;
  status: KitchenTicketStatus;
  completedAt?: string | null;
};

export type KitchenAnnouncement = {
  id: string;
  orderId: string;
  orderNumber: number;
  displayName: string;
  locale: 'uz' | 'ru';
  kind: 'auto' | 'replay';
  createdAt: string;
};

export type PosMonitorVariant = 'default' | 'light_compact';

export type KitchenMonitorQueue = {
  monitorVariant: PosMonitorVariant;
  preparing: KitchenMonitorTicket[];
  recentlyDone: KitchenMonitorTicket[];
  announcements: KitchenAnnouncement[];
};

export type TvMonitorPairingSession = {
  id: string;
  pollToken: string;
  claimToken: string;
  expiresAt: string;
};

export type TvMonitorRestaurantContext = {
  restaurantId: string;
  restaurantName: string;
  posMonitorVariant?: PosMonitorVariant;
};

export type TvMonitorPairingStatus =
  | { status: 'pending'; expiresAt: string }
  | { status: 'paired'; restaurantContext: TvMonitorRestaurantContext };

export type TvMonitorDeviceRegistration = TvMonitorRestaurantContext & {
  token: string;
};

export type TvMonitorPairingClaimResult = {
  status: 'paired';
  restaurantName: string;
};

export type TvMonitorDiagnosticEvent =
  | 'page_loaded'
  | 'queue_success'
  | 'queue_error'
  | 'render_error'
  | 'window_error'
  | 'unhandled_rejection'
  | 'announcement_play_started'
  | 'announcement_play_ended'
  | 'announcement_play_blocked'
  | 'announcement_play_error';

export type TvMonitorDiagnostic = {
  event: TvMonitorDiagnosticEvent;
  message?: string;
  clientTime: string;
  context?: Record<string, unknown>;
};
