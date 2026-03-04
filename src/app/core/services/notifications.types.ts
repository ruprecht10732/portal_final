export type NotificationCategory = 'info' | 'success' | 'warning' | 'error';
export type NotificationResourceType =
  | 'lead'
  | 'lead_feed'
  | 'quote'
  | 'appointment'
  | 'imap_account';

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  content: string;
  resourceId?: string;
  resourceType?: NotificationResourceType;
  category: NotificationCategory;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: InAppNotification[];
  total: number;
  page: number;
}

export interface NotificationUnreadCountResponse {
  count: number;
}

export interface NotificationStatusResponse {
  status: string;
}
