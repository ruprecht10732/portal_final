import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, filter, map, of } from 'rxjs';
import { AccountRegistryService } from '../../core/services/account-registry.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { UserService } from '../../core/services/user.service';
import { IMAPUnreadCountService } from '../../core/services/imap-unread-count.service';
import { WhatsAppUnreadCountService } from '../../core/services/whatsapp-unread-count.service';
import { isJwtExpired } from '../../core/utils/jwt-token.utils';
import type { UserProfile } from '../../core/services/user.types';
import { AddAccountSheetComponent } from '../../shared/components/add-account-sheet/add-account-sheet.component';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { AIJobBellComponent } from '../../shared/components/ai-job-bell/ai-job-bell.component';
import { MenuComponent, MenuItem, MenuSection } from '../../shared/components/menu/menu.component';

type MobileNavIcon =
  | 'dashboard'
  | 'leads'
  | 'tasks'
  | 'inbox'
  | 'partners'
  | 'appointments'
  | 'offertes'
  | 'settings'
  | 'agentWhatsapp'
  | 'profile';

interface MobileNavItem {
  label: string;
  route: string;
  matchPrefixes?: readonly string[];
  icon: MobileNavIcon;
}

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
              @case ('tasks') {
                <lucide-icon name="list-checks" class="h-5 w-5"></lucide-icon>
              }
              @case ('inbox') {
                <span class="relative inline-flex">
                  <lucide-icon name="mail" class="h-5 w-5"></lucide-icon>
                  @if (unreadMessagingCount() > 0) {
                    <span class="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white" aria-hidden="true">{{ unreadMessagingCount() }}</span>
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
                <span class="relative inline-flex">
                  <lucide-icon name="file-text" class="h-5 w-5"></lucide-icon>
                  @if (unreadQuoteNotifications() > 0) {
                    <span class="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white" aria-hidden="true">{{ unreadQuoteNotifications() }}</span>
                  }
                </span>
              }
              @case ('settings') {
                <lucide-icon name="settings" class="h-5 w-5"></lucide-icon>
              }
              @case ('agentWhatsapp') {
                <lucide-icon name="bot" class="h-5 w-5"></lucide-icon>
              }
              @case ('profile') {
                <lucide-icon name="user" class="h-5 w-5"></lucide-icon>
              }
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
  private readonly authService = inject(AuthService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly userService = inject(UserService);
  private readonly imapUnreadCountService = inject(IMAPUnreadCountService);
  private readonly whatsappUnreadCountService = inject(WhatsAppUnreadCountService);

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

  private static readonly AVATAR_COLORS = [
    '#e53935', '#d81b60', '#8e24aa', '#5e35b1',
    '#1e88e5', '#039be5', '#00897b', '#43a047',
    '#f4511e', '#fb8c00', '#fdd835', '#6d4c41',
  ];

  protected readonly userInitials = computed(() => {
    const user = this.user();
    if (!user) {
      return '?';
    }

    const first = user.firstName?.trim().charAt(0).toUpperCase() ?? '';
    const last = user.lastName?.trim().charAt(0).toUpperCase() ?? '';
    return first + last || user.email.charAt(0).toUpperCase();
  });

  protected readonly avatarColor = computed(() => {
    const user = this.user();
    const seed = user ? (user.firstName ?? user.email) : '';
    let hash = 0;
    for (let index = 0; index < seed.length; index++) {
      hash = (seed.codePointAt(index) ?? 0) + ((hash << 5) - hash);
    }

    const colors = AuthenticatedMobileNavComponent.AVATAR_COLORS;
    return colors[Math.abs(hash) % colors.length];
  });

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

      if (account.isActive) {
        item.detail = 'auth.account.current';
      }
      if (account.isExpired) {
        item.badge = 'auth.account.sessionExpired';
      }

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
      {
        label: 'menu.account',
        items: accountItems,
      },
      {
        items: actionItems,
      },
    ];
  });

  /** All primary navigation items — mirrors the desktop sidebar. */
  protected readonly items = computed<MobileNavItem[]>(() => {
    const base: MobileNavItem[] = [
      { label: 'navigation.dashboard', route: '/app/dashboard', icon: 'dashboard' },
      { label: 'navigation.leads', route: '/app/leads', icon: 'leads' },
      { label: 'navigation.messages', route: '/app/inbox', icon: 'inbox' },
      { label: 'navigation.offertes', route: '/app/offertes', icon: 'offertes' },
      { label: 'navigation.appointments', route: '/app/appointments', icon: 'appointments' },
      { label: 'navigation.partners', route: '/app/partners', matchPrefixes: ['/app/offers'], icon: 'partners' },
      { label: 'navigation.tasks', route: '/app/tasks', icon: 'tasks' },
      { label: 'navigation.settings', route: '/app/settings', icon: 'settings' },
    ];
    if (this.isSuperAdmin()) {
      base.push({ label: 'navigation.agentWhatsApp', route: '/app/agent-whatsapp', icon: 'agentWhatsapp' });
    }
    return base;
  });

  protected isNavItemActive(item: MobileNavItem): boolean {
    const currentUrl = this.currentUrl();
    if (currentUrl === item.route || currentUrl.startsWith(item.route + '/')) {
      return true;
    }

    return item.matchPrefixes?.some((prefix) => currentUrl === prefix || currentUrl.startsWith(prefix + '/')) ?? false;
  }

  protected handleProfileMenuSelection(item: MenuItem): void {
    if (!item.value) {
      return;
    }

    if (item.value.startsWith('switch:')) {
      const uid = item.value.replace('switch:', '');
      const targetAccount = this.accountRegistry.getAccount(uid);
      if (!targetAccount || targetAccount.isExpired) {
        return;
      }

      if (isJwtExpired(targetAccount.token)) {
        if (!targetAccount.refreshToken) {
          this.accountRegistry.markExpired(targetAccount.uid);
          return;
        }

        this.authService.refresh(targetAccount.refreshToken).subscribe({
          next: () => {
            if (!this.accountRegistry.switchAccount(uid)) {
              return;
            }
            globalThis.location.assign('/app/dashboard');
          },
          error: () => {
            this.accountRegistry.markExpired(targetAccount.uid);
          },
        });
        return;
      }

      if (!this.accountRegistry.switchAccount(uid)) {
        return;
      }

      globalThis.location.assign('/app/dashboard');
      return;
    }

    switch (item.value) {
      case 'add-account':
        this.showAddAccountSheet.set(true);
        return;
      case 'sign-out-current':
        this.signOutCurrentAccount();
        return;
      case 'sign-out-all':
        this.signOutAllAccounts();
        return;
      default:
        return;
    }
  }

  protected handleAddAccountClosed(): void {
    this.showAddAccountSheet.set(false);
  }

  protected handleAccountAdded(): void {
    this.showAddAccountSheet.set(false);
    globalThis.location.assign('/app/dashboard');
  }

  private signOutCurrentAccount(): void {
    const activeAccount = this.accountRegistry.activeAccountValue;
    if (!activeAccount) {
      void this.router.navigate(['/sign-in']);
      return;
    }

    this.authService.signOut(activeAccount.refreshToken).subscribe({
      next: () => this.finishCurrentAccountSignOut(activeAccount.uid),
      error: () => this.finishCurrentAccountSignOut(activeAccount.uid),
    });
  }

  private finishCurrentAccountSignOut(uid: string): void {
    const removal = this.accountRegistry.removeAccount(uid);
    if (removal.nextActive && !removal.nextActive.isExpired) {
      globalThis.location.assign('/app/dashboard');
      return;
    }

    void this.router.navigate(['/sign-in']);
  }

  private signOutAllAccounts(): void {
    if (this.accountRegistry.accounts().length > 0) {
      this.authService.signOutAllAccounts().subscribe({
        next: () => this.completeSignOutAll(),
        error: () => this.completeSignOutAll(),
      });
      return;
    }

    this.completeSignOutAll();
  }

  private completeSignOutAll(): void {
    this.accountRegistry.logoutAll();
    void this.router.navigate(['/sign-in']);
  }
}
