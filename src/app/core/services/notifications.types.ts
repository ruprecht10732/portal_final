export type NotificationCategory = 'info' | 'success' | 'warning' | 'error';

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  content: string;
  resourceId?: string;
  resourceType?: string;
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
