import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';
import { NotificationsService } from '../../../core/services/notifications.service';
import type { InAppNotification } from '../../../core/services/notifications.types';

@Component({
  selector: 'app-notification-bell',
  imports: [ButtonComponent, LucideAngularModule, DatePipe],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly router = inject(Router);

  protected readonly isOpen = signal(false);

  protected readonly notifications = this.notificationsService.notifications;
  protected readonly unreadCount = this.notificationsService.unreadCount;
  protected readonly loading = this.notificationsService.loading;
  protected readonly unreadInPanel = computed(() => this.notifications().filter(item => !item.isRead).length);
  protected readonly hasUnread = computed(() => this.unreadCount() > 0 || this.unreadInPanel() > 0);

  constructor() {
    this.notificationsService.refreshUnreadCount();
  }

  protected toggle(): void {
    const nextOpen = !this.isOpen();
    this.isOpen.set(nextOpen);
    if (nextOpen) {
      this.notificationsService.loadNotifications(1, 20);
      this.notificationsService.refreshUnreadCount();
    }
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected onMarkAllRead(event: MouseEvent): void {
    event.stopPropagation();
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
    if (route) {
      void this.router.navigate(route);
      this.close();
    }
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
