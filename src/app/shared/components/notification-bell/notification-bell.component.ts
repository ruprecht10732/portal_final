import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';
import { NotificationsService } from '../../../core/services/notifications.service';
import { NotificationSidebarStateService } from '../../../core/services/notification-sidebar-state.service';

@Component({
  selector: 'app-notification-bell',
  imports: [ButtonComponent, LucideAngularModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly sidebarState = inject(NotificationSidebarStateService);

  protected readonly unreadCount = this.notificationsService.unreadCount;
  protected readonly hasUnread = computed(() => this.unreadCount() > 0);
  protected readonly isOpen = this.sidebarState.isNotificationsOpen;

  protected toggle(): void {
    this.sidebarState.toggleNotifications();
  }
}
