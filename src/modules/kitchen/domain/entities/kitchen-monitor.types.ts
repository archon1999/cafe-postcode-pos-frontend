import type { KitchenTicketStatus } from '../enums';

export type KitchenMonitorTicket = {
  id: string;
  orderNumber: number;
  displayName?: string | null;
  status: KitchenTicketStatus;
  completedAt?: string | null;
};

export type KitchenMonitorQueue = {
  preparing: KitchenMonitorTicket[];
  recentlyDone: KitchenMonitorTicket[];
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
  | 'unhandled_rejection';

export type TvMonitorDiagnostic = {
  event: TvMonitorDiagnosticEvent;
  message?: string;
  clientTime: string;
  context?: Record<string, unknown>;
};
