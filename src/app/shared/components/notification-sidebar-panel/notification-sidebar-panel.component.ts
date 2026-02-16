import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { NotificationsService } from '../../../core/services/notifications.service';
import { NotificationSidebarStateService } from '../../../core/services/notification-sidebar-state.service';
import type { InAppNotification } from '../../../core/services/notifications.types';
import { ButtonComponent } from '../button/button.component';
import { RightSidebarComponent } from '../right-sidebar/right-sidebar.component';

@Component({
  selector: 'app-notification-sidebar-panel',
  imports: [ButtonComponent, DatePipe, LucideAngularModule, RightSidebarComponent],
  templateUrl: './notification-sidebar-panel.component.html',
  styleUrl: './notification-sidebar-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationSidebarPanelComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly sidebarState = inject(NotificationSidebarStateService);
  private readonly router = inject(Router);

  protected readonly isOpen = this.sidebarState.isNotificationsOpen;
  protected readonly notifications = this.notificationsService.notifications;
  protected readonly unreadCount = this.notificationsService.unreadCount;
  protected readonly loading = this.notificationsService.loading;
  protected readonly unreadInPanel = computed(() => this.notifications().filter(item => !item.isRead).length);
  protected readonly hasUnread = computed(() => this.unreadCount() > 0 || this.unreadInPanel() > 0);

  constructor() {
    effect(() => {
      if (!this.isOpen()) {
        return;
      }

      this.notificationsService.loadNotifications(1, 20);
      this.notificationsService.refreshUnreadCount();
    });
  }

  protected close(): void {
    this.sidebarState.close();
  }

  protected onMarkAllRead(): void {
    this.notificationsService.markAllAsRead().subscribe({
      next: () => {
        this.notificationsService.loadNotifications(1, 20);
        this.notificationsService.refreshUnreadCount();
      },
    });
  }

  protected onNotificationClick(notification: InAppNotification): void {
    if (!notification.isRead) {
      this.notificationsService.markAsRead(notification.id).subscribe();
    }

    const route = this.mapRoute(notification.resourceType, notification.resourceId);
    if (!route) {
      return;
    }

    void this.router.navigate(route);
    this.close();
  }

  protected onDeleteNotification(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.notificationsService.delete(id).subscribe();
  }

  protected trackById(_: number, notification: InAppNotification): string {
    return notification.id;
  }

  private mapRoute(resourceType?: string, resourceId?: string): string[] | null {
    if (!resourceType || !resourceId) {
      return null;
    }

    switch (resourceType) {
      case 'lead':
      case 'lead_feed':
        return ['/app/leads', resourceId];
      case 'quote':
        return ['/app/offertes', resourceId];
      case 'appointment':
        return ['/app/appointments', resourceId];
      default:
        return null;
    }
  }
}
