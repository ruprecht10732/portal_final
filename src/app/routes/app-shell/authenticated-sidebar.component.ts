import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, filter, map, of } from 'rxjs';
import { AccountRegistryService } from '../../core/services/account-registry.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { AddAccountSheetComponent } from '../../shared/components/add-account-sheet/add-account-sheet.component';
import { MenuComponent, MenuItem, MenuSection } from '../../shared/components/menu/menu.component';
import { AuthenticatedSidebarPanelComponent } from './authenticated-sidebar-panel.component';
import { SidebarPanelItem } from './sidebar-panel.config';
import { NotificationsService } from '../../core/services/notifications.service';
import { UserService } from '../../core/services/user.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { AIJobBellComponent } from '../../shared/components/ai-job-bell/ai-job-bell.component';
import { AgentApprovalsService } from '../../core/services/agent-approvals.service';
import { IMAPUnreadCountService } from '../../core/services/imap-unread-count.service';
import { WhatsAppUnreadCountService } from '../../core/services/whatsapp-unread-count.service';
import type { UserProfile } from '../../core/services/user.types';
import { buildNavItems, computeAvatarColor, computeUserInitials, isNavItemActive, type NavItem } from './user-nav.utils';
import { filterPanelItemsForCurrentUser, isRouteActive, isRouteExact, resolvePanelItems } from './panel-utils';
import { UserNavService } from './user-nav.service';

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
  private readonly notificationsService = inject(NotificationsService);
  private readonly imapUnreadCountService = inject(IMAPUnreadCountService);
  private readonly whatsappUnreadCountService = inject(WhatsAppUnreadCountService);
  private readonly userService = inject(UserService);
  private readonly agentApprovalsService = inject(AgentApprovalsService);
  private readonly userNavService = inject(UserNavService);
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
    this.userService.getProfile().pipe(catchError(() => of(null))),
    { initialValue: null as UserProfile | null },
  );

  protected readonly isAdmin = computed(() => this.user()?.roles?.includes('admin') ?? false);
  protected readonly isSuperAdmin = computed(() => this.user()?.roles?.includes('superadmin') ?? false);

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

  protected readonly items = computed<NavItem[]>(() => buildNavItems(this.isSuperAdmin()));

  private readonly rawPanelItems = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => resolvePanelItems(this.route)),
    ),
    { initialValue: resolvePanelItems(this.route) },
  );

  protected readonly panelItems = computed(() => {
    const items = filterPanelItemsForCurrentUser(this.rawPanelItems(), this.user()?.roles ?? []);
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

  protected isNavItemActive(item: NavItem): boolean {
    return isNavItemActive(this.currentUrl(), item);
  }

  private getActivePanelItem(): SidebarPanelItem | undefined {
    const url = this.currentUrl();
    return this.panelItems()
      .filter((item) => (item.exact ?? false) ? isRouteExact(url, item.route) : isRouteActive(url, item.route))
      .sort((left, right) => right.route.length - left.route.length)[0];
  }

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
    if (!item.value) return;

    if (item.value.startsWith('switch:')) {
      this.userNavService.switchAccount(item.value.replace('switch:', ''));
      return;
    }

    switch (item.value) {
      case 'add-account':
        this.showAddAccountSheet.set(true);
        return;
      case 'sign-out-current':
        this.userNavService.signOutCurrentAccount();
        return;
      case 'sign-out-all':
        this.userNavService.signOutAllAccounts();
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
}
