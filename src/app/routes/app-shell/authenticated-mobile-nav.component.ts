import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, filter, map, of } from 'rxjs';
import { AccountRegistryService } from '../../core/services/account-registry.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { UserService } from '../../core/services/user.service';
import { IMAPUnreadCountService } from '../../core/services/imap-unread-count.service';
import { WhatsAppUnreadCountService } from '../../core/services/whatsapp-unread-count.service';
import type { UserProfile } from '../../core/services/user.types';
import { AddAccountSheetComponent } from '../../shared/components/add-account-sheet/add-account-sheet.component';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { AIJobBellComponent } from '../../shared/components/ai-job-bell/ai-job-bell.component';
import { MenuComponent, MenuItem, MenuSection } from '../../shared/components/menu/menu.component';
import { buildNavItems, computeAvatarColor, computeUserInitials, isNavItemActive, type NavItem } from './user-nav.utils';
import { UserNavService } from './user-nav.service';

@Component({
  selector: 'app-authenticated-mobile-nav',
  imports: [
    RouterLink,
    LucideAngularModule,
    TranslatePipe,
    NotificationBellComponent,
    AIJobBellComponent,
    MenuComponent,
    AddAccountSheetComponent,
  ],
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
      <div class="mobile-nav-scroll flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1">
        @for (item of items(); track item.route) {
          <a
            class="flex min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-zinc-500 transition-colors active:bg-zinc-100"
            [class.text-black]="isNavItemActive(item)"
            [class.font-semibold]="isNavItemActive(item)"
            [routerLink]="item.route"
            [attr.aria-label]="item.label | translate"
          >
            @if (badgeFor(item.icon) > 0) {
              <span class="relative inline-flex">
                <lucide-icon [name]="iconName(item.icon)" class="h-5 w-5"></lucide-icon>
                <span class="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white" aria-hidden="true">{{ badgeFor(item.icon) }}</span>
              </span>
            } @else {
              <lucide-icon [name]="iconName(item.icon)" class="h-5 w-5"></lucide-icon>
            }
            <span class="text-[10px] leading-tight">{{ item.label | translate }}</span>
          </a>
        }
      </div>

      <div class="flex shrink-0 items-center gap-1 border-l border-zinc-200 bg-white px-2">
        <div class="flex shrink-0 items-center">
          <app-notification-bell></app-notification-bell>
        </div>
        <div class="flex shrink-0 items-center">
          <app-ai-job-bell></app-ai-job-bell>
        </div>
        <shared-menu
          triggerLabel="navigation.profile"
          ariaLabel="navigation.profile"
          [iconOnly]="true"
          [showChevron]="false"
          [triggerVariant]="'ghost'"
          [triggerSize]="'compact'"
          [triggerShape]="'round'"
          [fullWidth]="false"
          [sections]="profileMenu()"
          [tooltip]="'navigation.profile' | translate"
          (itemSelected)="handleProfileMenuSelection($event)"
        >
          <span menuTrigger class="relative flex shrink-0 items-center justify-center select-none" style="width:2.5rem;height:2.5rem" aria-hidden="true">
            <span class="absolute inset-0 rounded-full" style="background:conic-gradient(#4285F4 0deg 120deg,#EA4335 120deg 240deg,#34A853 240deg 360deg)"></span>
            <span class="absolute rounded-full" style="inset:4px;background:#f4f4f5"></span>
            <span
              class="relative z-10 flex items-center justify-center rounded-full text-[10px] font-bold leading-none text-white"
              style="width:calc(2.5rem - 10px);height:calc(2.5rem - 10px)"
              [style.background-color]="avatarColor()"
            >{{ userInitials() }}</span>
          </span>
        </shared-menu>
      </div>
    </nav>

    <app-add-account-sheet
      [isOpen]="showAddAccountSheet()"
      (closed)="handleAddAccountClosed()"
      (accountAdded)="handleAccountAdded()"
    ></app-add-account-sheet>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedMobileNavComponent {
  private readonly router = inject(Router);
  private readonly accountRegistry = inject(AccountRegistryService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly userService = inject(UserService);
  private readonly imapUnreadCountService = inject(IMAPUnreadCountService);
  private readonly whatsappUnreadCountService = inject(WhatsAppUnreadCountService);
  private readonly userNavService = inject(UserNavService);

  protected readonly showAddAccountSheet = signal(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly user = toSignal(
    this.userService.getProfile().pipe(catchError(() => of(null))),
    { initialValue: null as UserProfile | null },
  );

  private readonly isAdmin = computed(() => this.user()?.roles?.includes('admin') ?? false);
  private readonly isSuperAdmin = computed(() => this.user()?.roles?.includes('superadmin') ?? false);

  protected readonly userInitials = computed(() => computeUserInitials(this.user()));
  protected readonly avatarColor = computed(() => computeAvatarColor(this.user()));

  protected readonly unreadLeadNotifications = this.notificationsService.unreadLeadCount;
  protected readonly unreadQuoteNotifications = this.notificationsService.unreadQuoteCount;
  protected readonly unreadInboxMessages = this.imapUnreadCountService.unreadCount;
  protected readonly unreadWhatsAppConversations = this.whatsappUnreadCountService.unreadCount;
  protected readonly unreadMessagingCount = computed(() => {
    const emailCount = this.unreadInboxMessages();
    const whatsAppCount = this.isAdmin() ? this.unreadWhatsAppConversations() : 0;
    return emailCount + whatsAppCount;
  });

  protected readonly profileMenu = computed<MenuSection[]>(() => {
    const accountItems: MenuItem[] = this.accountRegistry.accounts().map(account => {
      const item: MenuItem = {
        label: account.email || 'auth.account.unknown',
        value: `switch:${account.uid}`,
        tone: account.isExpired ? 'danger' : 'default',
        disabled: account.isExpired || account.isActive,
      };

      if (account.isActive) item.detail = 'auth.account.current';
      if (account.isExpired) item.badge = 'auth.account.sessionExpired';

      return item;
    });

    const actionItems: MenuItem[] = [
      { label: 'navigation.profile', route: '/app/profile', value: 'profile' },
      { label: 'auth.account.addAccount', value: 'add-account', icon: 'plus' },
      { label: 'auth.account.signOutCurrent', value: 'sign-out-current', icon: 'log-out' },
    ];

    if (this.accountRegistry.accounts().length > 1) {
      actionItems.push({ label: 'auth.account.signOutAll', value: 'sign-out-all', icon: 'log-out' });
    }

    return [
      { label: 'menu.account', items: accountItems },
      { items: actionItems },
    ];
  });

  protected readonly items = computed<NavItem[]>(() => buildNavItems(this.isSuperAdmin()));

  protected iconName(icon: string): string {
    const map: Record<string, string> = {
      dashboard: 'layout-dashboard',
      leads: 'users',
      tasks: 'list-checks',
      inbox: 'mail',
      partners: 'briefcase',
      appointments: 'calendar-check',
      offertes: 'file-text',
      settings: 'settings',
      agentWhatsapp: 'bot',
      profile: 'user',
    };
    return map[icon] ?? 'circle';
  }

  protected badgeFor(icon: string): number {
    switch (icon) {
      case 'leads': return this.unreadLeadNotifications();
      case 'inbox': return this.unreadMessagingCount();
      case 'offertes': return this.unreadQuoteNotifications();
      default: return 0;
    }
  }

  protected isNavItemActive(item: NavItem): boolean {
    return isNavItemActive(this.currentUrl(), item);
  }

  protected handleProfileMenuSelection(item: MenuItem): void {
    if (!item.value) return;

    if (item.value.startsWith('switch:')) {
      this.userNavService.switchAccount(item.value.replace('switch:', ''));
      return;
    }

    switch (item.value) {
      case 'add-account':
        this.showAddAccountSheet.set(true);
        break;
      case 'sign-out-current':
        this.userNavService.signOutCurrentAccount();
        break;
      case 'sign-out-all':
        this.userNavService.signOutAllAccounts();
        break;
    }
  }

  protected handleAddAccountClosed(): void {
    this.showAddAccountSheet.set(false);
  }

  protected handleAccountAdded(): void {
    this.showAddAccountSheet.set(false);
    globalThis.location.assign('/app/dashboard');
  }
}
