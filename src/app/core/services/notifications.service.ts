import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SSEService } from './sse.service';
import { ToastService } from './toast.service';
import type {
  InAppNotification,
  NotificationListResponse,
  NotificationStatusResponse,
  NotificationUnreadCountResponse,
} from './notifications.types';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly sse = inject(SSEService);
  private readonly toast = inject(ToastService);

  private readonly baseUrl = `${environment.apiBaseUrl}/notifications`;
  private readonly notificationsState = signal<InAppNotification[]>([]);
  private readonly unreadCountState = signal(0);
  private readonly unreadLeadCountState = signal(0);
  private readonly unreadQuoteCountState = signal(0);
  private readonly loadingState = signal(false);

  readonly notifications = this.notificationsState.asReadonly();
  readonly unreadCount = this.unreadCountState.asReadonly();
  readonly unreadLeadCount = this.unreadLeadCountState.asReadonly();
  readonly unreadQuoteCount = this.unreadQuoteCountState.asReadonly();
  readonly loading = this.loadingState.asReadonly();

  constructor() {
    this.sse.inAppNotification
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        const notification = this.asNotification(event.data);
        if (!notification) return;
        this.prependNotification(notification);
      });

    this.loadNotifications(1, 50);
    this.refreshUnreadCount();
    this.refreshUnreadLeadCount();
    this.refreshUnreadQuoteCount();
  }

  list(page = 1, limit = 20): Observable<NotificationListResponse> {
    return this.http.get<NotificationListResponse>(this.baseUrl, {
      params: {
        page: String(page),
        limit: String(limit),
      },
    });
  }

  getUnreadCount(): Observable<NotificationUnreadCountResponse> {
    return this.http.get<NotificationUnreadCountResponse>(`${this.baseUrl}/unread`);
  }

  getUnreadCountByResourceTypes(resourceTypes: string[]): Observable<NotificationUnreadCountResponse> {
    return this.http.get<NotificationUnreadCountResponse>(`${this.baseUrl}/unread-by-resource`, {
      params: {
        types: resourceTypes.join(','),
      },
    });
  }

  refreshUnreadCount(): void {
    this.getUnreadCount().subscribe({
      next: response => this.unreadCountState.set(response.count),
      error: () => this.unreadCountState.set(0),
    });
  }

  refreshUnreadLeadCount(): void {
    this.getUnreadCountByResourceTypes(['lead', 'lead_feed']).subscribe({
      next: response => this.unreadLeadCountState.set(response.count),
      error: () => this.unreadLeadCountState.set(0),
    });
  }

  refreshUnreadQuoteCount(): void {
    this.getUnreadCountByResourceTypes(['quote']).subscribe({
      next: response => this.unreadQuoteCountState.set(response.count),
      error: () => this.unreadQuoteCountState.set(0),
    });
  }

  loadNotifications(page = 1, limit = 20): void {
    this.loadingState.set(true);
    this.list(page, limit).subscribe({
      next: response => {
        this.notificationsState.set(response.items);
        this.loadingState.set(false);
      },
      error: () => {
        this.loadingState.set(false);
      },
    });
  }

  markAsRead(id: string): Observable<void> {
    const target = this.notificationsState().find(item => item.id === id);
    const wasUnread = target && !target.isRead;
    const wasUnreadLead = wasUnread && (target.resourceType === 'lead' || target.resourceType === 'lead_feed');
    const wasUnreadQuote = wasUnread && target.resourceType === 'quote';

    return this.http.patch<NotificationStatusResponse>(`${this.baseUrl}/${id}/read`, {}).pipe(
      tap(() => {
        this.notificationsState.update(items => items.map(item => item.id === id ? { ...item, isRead: true } : item));
        if (wasUnread) {
          this.unreadCountState.update(count => Math.max(0, count - 1));
        }
        if (wasUnreadLead) {
          this.unreadLeadCountState.update(count => Math.max(0, count - 1));
        }
        if (wasUnreadQuote) {
          this.unreadQuoteCountState.update(count => Math.max(0, count - 1));
        }
      }),
      catchError(error => {
        this.toast.error('Kon notificatie niet als gelezen markeren');
        this.loadNotifications(1, 20);
        this.refreshUnreadCount();
        this.refreshUnreadLeadCount();
        this.refreshUnreadQuoteCount();
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  markAllAsRead(): Observable<void> {
    const counts = this.notificationsState().reduce(
      (acc, item) => {
        if (item.isRead) return acc;
        acc.unread++;
        if (item.resourceType === 'lead' || item.resourceType === 'lead_feed') acc.lead++;
        if (item.resourceType === 'quote') acc.quote++;
        return acc;
      },
      { unread: 0, lead: 0, quote: 0 }
    );

    return this.http.patch<NotificationStatusResponse>(`${this.baseUrl}/read-all`, {}).pipe(
      tap(() => {
        this.notificationsState.update(items => items.map(item => item.isRead ? item : { ...item, isRead: true }));
        if (counts.unread > 0) {
          this.unreadCountState.update(count => Math.max(0, count - counts.unread));
        }
        if (counts.lead > 0) {
          this.unreadLeadCountState.update(count => Math.max(0, count - counts.lead));
        }
        if (counts.quote > 0) {
          this.unreadQuoteCountState.update(count => Math.max(0, count - counts.quote));
        }
      }),
      catchError(error => {
        this.toast.error('Kon notificaties niet als gelezen markeren');
        this.loadNotifications(1, 20);
        this.refreshUnreadCount();
        this.refreshUnreadLeadCount();
        this.refreshUnreadQuoteCount();
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  delete(id: string): Observable<void> {
    const target = this.notificationsState().find(item => item.id === id);
    const wasUnread = target && !target.isRead;
    const wasUnreadLead = wasUnread && (target.resourceType === 'lead' || target.resourceType === 'lead_feed');
    const wasUnreadQuote = wasUnread && target.resourceType === 'quote';

    return this.http.delete<NotificationStatusResponse>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.notificationsState.update(items => items.filter(item => item.id !== id));
        if (wasUnread) {
          this.unreadCountState.update(count => Math.max(0, count - 1));
        }
        if (wasUnreadLead) {
          this.unreadLeadCountState.update(count => Math.max(0, count - 1));
        }
        if (wasUnreadQuote) {
          this.unreadQuoteCountState.update(count => Math.max(0, count - 1));
        }
      }),
      catchError(error => {
        this.toast.error('Kon notificatie niet verwijderen');
        this.loadNotifications(1, 20);
        this.refreshUnreadCount();
        this.refreshUnreadLeadCount();
        this.refreshUnreadQuoteCount();
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  private prependNotification(notification: InAppNotification): void {
    this.notificationsState.update(current => {
      if (current.some(item => item.id === notification.id)) {
        return current;
      }
      return [notification, ...current].slice(0, 50);
    });

    if (!notification.isRead) {
      this.unreadCountState.update(count => count + 1);
      if (notification.resourceType === 'lead' || notification.resourceType === 'lead_feed') {
        this.unreadLeadCountState.update(count => count + 1);
      }
      if (notification.resourceType === 'quote') {
        this.unreadQuoteCountState.update(count => count + 1);
      }
    }
  }

  private asNotification(value: unknown): InAppNotification | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const maybeNotification = value as Partial<InAppNotification>;
    if (!maybeNotification.id || !maybeNotification.title || !maybeNotification.content || !maybeNotification.category || !maybeNotification.createdAt) {
      return null;
    }

    return {
      id: maybeNotification.id,
      userId: maybeNotification.userId ?? '',
      title: maybeNotification.title,
      content: maybeNotification.content,
      category: maybeNotification.category,
      isRead: Boolean(maybeNotification.isRead),
      createdAt: maybeNotification.createdAt,
      ...(maybeNotification.resourceId ? { resourceId: maybeNotification.resourceId } : {}),
      ...(maybeNotification.resourceType ? { resourceType: maybeNotification.resourceType } : {}),
    };
  }
}
