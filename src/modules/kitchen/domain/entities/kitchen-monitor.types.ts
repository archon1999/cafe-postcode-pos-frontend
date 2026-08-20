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
  claimUrl: string;
  qrPath: string;
  qrSize: number;
  displayCode: string;
  expiresAt: string;
  status: 'pending' | 'rejected' | 'expired';
};

export type TvMonitorRestaurantContext = {
  restaurantId: string;
  restaurantName: string;
  posMonitorVariant?: PosMonitorVariant;
};

export type TvMonitorPairingStatus =
  | { status: 'pending'; expiresAt: string }
  | { status: 'rejected' | 'expired' }
  | { status: 'paired'; device: TvMonitorDevice; restaurantContext: TvMonitorRestaurantContext };

export type TvMonitorDevice = {
  id: string;
  type: 'TV_MONITOR';
  name: string;
  status: 'ACTIVE' | 'REVOKED';
  leaseExpiresAt: string;
  pairedAt?: string;
  lastSeenAt?: string | null;
};

export type TvMonitorDeviceRegistration = TvMonitorRestaurantContext & {
  deviceId: string;
  deviceStatus: TvMonitorDevice['status'];
  leaseExpiresAt: string;
};

export type TvMonitorBootstrapResult =
  | { status: 'paired'; device: TvMonitorDeviceRegistration }
  | { status: 'pairing'; pairing: TvMonitorPairingSession }
  | { status: 'unpaired' };

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
