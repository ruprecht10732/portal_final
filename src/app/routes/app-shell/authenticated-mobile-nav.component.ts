import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { NotificationsService } from '../../core/services/notifications.service';
import { UserService } from '../../core/services/user.service';
import type { UserProfile } from '../../core/services/user.types';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';

type MobileNavIcon =
  | 'dashboard'
  | 'leads'
  | 'partners'
  | 'appointments'
  | 'offertes'
  | 'catalog'
  | 'services'
  | 'organization'
  | 'profile';

interface MobileNavItem {
  label: string;
  route: string;
  icon: MobileNavIcon;
}

@Component({
  selector: 'app-authenticated-mobile-nav',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule, TranslatePipe, NotificationBellComponent],
  styles: `
    :host { display: contents; }
    .mobile-nav-scroll { scrollbar-width: none; -ms-overflow-style: none; }
    .mobile-nav-scroll::-webkit-scrollbar { display: none; }
  `,
  template: `
    <nav
      class="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-zinc-200 bg-white lg:hidden"
      [attr.aria-label]="'sidebar.mobileNavigation' | translate"
    >
      <div class="mobile-nav-scroll flex flex-1 items-center gap-0.5 overflow-x-auto px-1">
        @for (item of items(); track item.route) {
          <a
            class="flex min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-zinc-500 transition-colors active:bg-zinc-100"
            [class.text-black]="navActive.isActive"
            [class.font-semibold]="navActive.isActive"
            [routerLink]="item.route"
            routerLinkActive
            #navActive="routerLinkActive"
            [attr.aria-label]="item.label | translate"
          >
            @switch (item.icon) {
              @case ('dashboard') {
                <lucide-icon name="layout-dashboard" class="h-5 w-5"></lucide-icon>
              }
              @case ('leads') {
                <span class="relative inline-flex">
                  <lucide-icon name="users" class="h-5 w-5"></lucide-icon>
                  @if (unreadLeadNotifications() > 0) {
                    <span class="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white" aria-hidden="true">{{ unreadLeadNotifications() }}</span>
                  }
                </span>
              }
              @case ('partners') {
                <lucide-icon name="briefcase" class="h-5 w-5"></lucide-icon>
              }
              @case ('appointments') {
                <lucide-icon name="calendar-check" class="h-5 w-5"></lucide-icon>
              }
              @case ('offertes') {
                <lucide-icon name="file-text" class="h-5 w-5"></lucide-icon>
              }
              @case ('catalog') {
                <lucide-icon name="book-open" class="h-5 w-5"></lucide-icon>
              }
              @case ('services') {
                <lucide-icon name="wrench" class="h-5 w-5"></lucide-icon>
              }
              @case ('organization') {
                <lucide-icon name="building" class="h-5 w-5"></lucide-icon>
              }
              @case ('profile') {
                <lucide-icon name="user" class="h-5 w-5"></lucide-icon>
              }
            }
            <span class="text-[10px] leading-tight">{{ item.label | translate }}</span>
          </a>
        }
        <div class="ml-1 flex shrink-0 items-center">
          <app-notification-bell></app-notification-bell>
        </div>
      </div>
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedMobileNavComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly userService = inject(UserService);

  private readonly user = toSignal(
    this.userService.getProfile().pipe(catchError(() => of(null))),
    { initialValue: null as UserProfile | null },
  );

  private readonly isAdmin = computed(() => this.user()?.roles?.includes('admin') ?? false);

  protected readonly unreadLeadNotifications = this.notificationsService.unreadLeadCount;

  /** All primary navigation items — mirrors the desktop sidebar. */
  protected readonly items = computed<MobileNavItem[]>(() => {
    const base: MobileNavItem[] = [
      { label: 'navigation.dashboard', route: '/app/dashboard', icon: 'dashboard' },
      { label: 'navigation.leads', route: '/app/leads', icon: 'leads' },
      { label: 'navigation.partners', route: '/app/partners', icon: 'partners' },
      { label: 'navigation.appointments', route: '/app/appointments', icon: 'appointments' },
      { label: 'navigation.offertes', route: '/app/offertes', icon: 'offertes' },
      { label: 'navigation.catalog', route: '/app/catalog', icon: 'catalog' },
    ];
    if (this.isAdmin()) {
      base.splice(3, 0, { label: 'navigation.services', route: '/app/services', icon: 'services' });
      base.push({ label: 'navigation.organization', route: '/app/organization', icon: 'organization' });
    }
    base.push({ label: 'navigation.profile', route: '/app/profile', icon: 'profile' });
    return base;
  });
}
