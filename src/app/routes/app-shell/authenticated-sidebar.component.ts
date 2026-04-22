import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule
} from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, filter, map, of } from 'rxjs';
import { AccountRegistryService } from '../../core/services/account-registry.service';
import { isJwtExpired } from '../../core/utils/jwt-token.utils';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { AddAccountSheetComponent } from '../../shared/components/add-account-sheet/add-account-sheet.component';
import { MenuComponent, MenuItem, MenuSection } from '../../shared/components/menu/menu.component';
import { AuthenticatedSidebarPanelComponent } from './authenticated-sidebar-panel.component';
import { SidebarPanelItem } from './sidebar-panel.config';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { UserService } from '../../core/services/user.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { AIJobBellComponent } from '../../shared/components/ai-job-bell/ai-job-bell.component';
import { AgentApprovalsService } from '../../core/services/agent-approvals.service';
import { IMAPUnreadCountService } from '../../core/services/imap-unread-count.service';
import { WhatsAppUnreadCountService } from '../../core/services/whatsapp-unread-count.service';
import type { UserProfile } from '../../core/services/user.types';

interface SidebarItem {
  label: string;
  route: string;
  matchPrefixes?: readonly string[];
  icon:
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
}

interface SidebarTooltip {
  route: string;
  label: string;
  top: number;
  left: number;
}

@Component({
  selector: 'app-authenticated-sidebar',
  imports: [
    RouterLink,
    ButtonComponent,
    AddAccountSheetComponent,
    MenuComponent,
    LucideAngularModule,
    AuthenticatedSidebarPanelComponent,
    NotificationBellComponent,
    AIJobBellComponent,
    TranslatePipe,
  ],
  templateUrl: './authenticated-sidebar.component.html',
  styleUrl: './authenticated-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedSidebarComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly accountRegistry = inject(AccountRegistryService);
  private readonly authService = inject(AuthService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly imapUnreadCountService = inject(IMAPUnreadCountService);
  private readonly whatsappUnreadCountService = inject(WhatsAppUnreadCountService);
  private readonly userService = inject(UserService);
  private readonly agentApprovalsService = inject(AgentApprovalsService);
  private readonly stopPollingCount: () => void;

  constructor() {
    this.stopPollingCount = this.agentApprovalsService.startPollingCount(30000);
  }

  ngOnDestroy(): void {
    this.stopPollingCount();
  }

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isExpanded = signal(true);
  protected readonly hoveredTooltip = signal<SidebarTooltip | null>(null);
  protected readonly suppressHoverTooltip = signal(false);
  protected readonly showAddAccountSheet = signal(false);

  private readonly user = toSignal(
    this.userService.getProfile().pipe(
      catchError(() => of(null)),
    ),
    { initialValue: null as UserProfile | null },
  );

  protected readonly isAdmin = computed(() => this.user()?.roles?.includes('admin') ?? false);
  protected readonly isSuperAdmin = computed(() => this.user()?.roles?.includes('superadmin') ?? false);

  protected readonly userInitials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const first = u.firstName?.trim().charAt(0).toUpperCase() ?? '';
    const last = u.lastName?.trim().charAt(0).toUpperCase() ?? '';
    return first + last || u.email.charAt(0).toUpperCase();
  });

  private static readonly AVATAR_COLORS = [
    '#e53935', '#d81b60', '#8e24aa', '#5e35b1',
    '#1e88e5', '#039be5', '#00897b', '#43a047',
    '#f4511e', '#fb8c00', '#fdd835', '#6d4c41',
  ];

  protected readonly avatarColor = computed(() => {
    const u = this.user();
    const seed = u ? (u.firstName ?? u.email) : '';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (seed.codePointAt(i) ?? 0) + ((hash << 5) - hash);
    }
    const colors = AuthenticatedSidebarComponent.AVATAR_COLORS;
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

  protected readonly items = computed<SidebarItem[]>(() => {
    const base: SidebarItem[] = [
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

  private readonly rawPanelItems = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.getPanelItemsFromRoute()),
    ),
    { initialValue: this.getPanelItemsFromRoute() },
  );

  protected readonly panelItems = computed(() => {
    const items = this.filterPanelItemsForCurrentUser(this.rawPanelItems());
    const pending = this.agentApprovalsService.pendingCount();
    return items.map((item) =>
      item.route === '/app/settings/agent-approvals' && pending > 0
        ? { ...item, badge: pending }
        : item,
    );
  });
  protected readonly showPanel = computed(() => this.isExpanded() && this.panelItems().length > 1);

  protected readonly activeTitle = computed(() => {
    const panelItem = this.getActivePanelItem();
    if (panelItem) {
      return panelItem.label;
    }

    const item = this.items().find((candidate) => this.isNavItemActive(candidate));
    return item?.label ?? '';
  });

  protected isNavItemActive(item: SidebarItem): boolean {
    if (this.isRouteActive(item.route, false)) {
      return true;
    }

    return item.matchPrefixes?.some((prefix) => this.isRouteActive(prefix, false)) ?? false;
  }

  private getActivePanelItem(): SidebarPanelItem | undefined {
    return this.panelItems()
      .filter((item) => this.isRouteActive(item.route, item.exact ?? false))
      .sort((left, right) => right.route.length - left.route.length)[0];
  }

  private filterPanelItemsForCurrentUser(items: SidebarPanelItem[]): SidebarPanelItem[] {
    const roles = this.user()?.roles ?? [];
    return items.filter((item) => {
      if (!item.roles || item.roles.length === 0) {
        return true;
      }

      return item.roles.some((role) => roles.includes(role));
    });
  }

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

  private isRouteActive(route: string, exact: boolean): boolean {
    const url = this.currentUrl();
    return exact ? url === route : url.startsWith(route);
  }

  private getPanelItemsFromRoute(): SidebarPanelItem[] {
    let currentRoute: ActivatedRoute | null = this.route.root;
    let panelItems: SidebarPanelItem[] = [];

    while (currentRoute) {
      if (currentRoute.snapshot?.data?.['panelItems']) {
        panelItems = currentRoute.snapshot.data['panelItems'];
      }
      currentRoute = currentRoute.firstChild;
    }

    return panelItems;
  }

  protected toggleExpanded(): void {
    this.isExpanded.update((value) => !value);
  }

  protected handleNavItemEnter(route: string, label: string, element: HTMLElement): void {
    const button = element.querySelector('button');
    const target = button instanceof HTMLElement ? button : element;
    const rect = target.getBoundingClientRect();

    this.suppressHoverTooltip.set(false);
    this.hoveredTooltip.set({
      route,
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  }

  protected handleNavItemLeave(route: string): void {
    if (this.hoveredTooltip()?.route === route) {
      this.hoveredTooltip.set(null);
    }
  }

  protected handleNavItemClick(): void {
    this.suppressHoverTooltip.set(true);
    this.hoveredTooltip.set(null);
  }

  protected handleProfileMenuSelection(item: MenuItem): void {
    if (!item.value) {
      return;
    }

    if (item.value.startsWith('switch:')) {
      const uid = item.value.replace('switch:', '');
      const targetAccount = this.accountRegistry.getAccount(uid);
      if (!targetAccount) {
        return;
      }

      if (targetAccount.isExpired) {
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
