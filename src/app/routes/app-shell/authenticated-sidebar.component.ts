import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule
} from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, filter, map, of } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MenuComponent, MenuItem, MenuSection } from '../../shared/components/menu/menu.component';
import { AuthenticatedSidebarPanelComponent } from './authenticated-sidebar-panel.component';
import { SidebarPanelItem } from './sidebar-panel.config';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { TokenStorageService } from '../../core/services/token-storage.service';
import { UserService } from '../../core/services/user.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { AIJobBellComponent } from '../../shared/components/ai-job-bell/ai-job-bell.component';
import { IMAPUnreadCountService } from '../../core/services/imap-unread-count.service';
import { WhatsAppUnreadCountService } from '../../core/services/whatsapp-unread-count.service';
import type { UserProfile } from '../../core/services/user.types';

interface SidebarItem {
  label: string;
  route: string;
  icon:
    | 'dashboard'
    | 'search'
    | 'leads'
    | 'inbox'
    | 'whatsapp'
    | 'partners'
    | 'partnerOffers'
    | 'appointments'
    | 'services'
    | 'offertes'
    | 'catalog'
    | 'organization'
    | 'profile';
}

@Component({
  selector: 'app-authenticated-sidebar',
  imports: [
    RouterLink,
    ButtonComponent,
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
export class AuthenticatedSidebarComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly imapUnreadCountService = inject(IMAPUnreadCountService);
  private readonly whatsappUnreadCountService = inject(WhatsAppUnreadCountService);
  private readonly tokens = inject(TokenStorageService);
  private readonly userService = inject(UserService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isExpanded = signal(true);
  protected readonly hoveredItemRoute = signal<string | null>(null);
  protected readonly suppressHoverTooltip = signal(false);

  private readonly user = toSignal(
    this.userService.getProfile().pipe(
      catchError(() => of(null)),
    ),
    { initialValue: null as UserProfile | null },
  );

  protected readonly isAdmin = computed(() => this.user()?.roles?.includes('admin') ?? false);

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

  protected readonly items = computed<SidebarItem[]>(() => {
    const base: SidebarItem[] = [
      { label: 'navigation.dashboard', route: '/app/dashboard', icon: 'dashboard' },
      { label: 'navigation.search', route: '/app/search', icon: 'search' },
      { label: 'navigation.leads', route: '/app/leads', icon: 'leads' },
      { label: 'navigation.inbox', route: '/app/inbox', icon: 'inbox' },
      { label: 'navigation.whatsapp', route: '/app/whatsapp', icon: 'whatsapp' },
      { label: 'navigation.partners', route: '/app/partners', icon: 'partners' },
      { label: 'navigation.partnerOffers', route: '/app/offers', icon: 'partnerOffers' },
      { label: 'navigation.appointments', route: '/app/appointments', icon: 'appointments' },
      { label: 'navigation.offertes', route: '/app/offertes', icon: 'offertes' },
      { label: 'navigation.catalog', route: '/app/catalog', icon: 'catalog' },
    ];
    if (this.isAdmin()) {
      base.splice(4, 0, { label: 'navigation.services', route: '/app/services', icon: 'services' });
      base.push({ label: 'navigation.organization', route: '/app/organization', icon: 'organization' });
    }
    return base;
  });

  protected readonly profileMenu: MenuSection[] = [
    {
      label: 'menu.account',
      items: [
        { label: 'navigation.profile', route: '/app/profile' },
        { label: 'menu.signOut' },
      ],
    },
  ];

  protected readonly activeTitle = computed(() => {
    const item = this.items().find((i) => this.isNavItemActive(i));
    return item?.label ?? '';
  });

  protected isNavItemActive(item: SidebarItem): boolean {
    const url = this.currentUrl();

    return url.startsWith(item.route);
  }

  protected readonly panelItems = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.getPanelItemsFromRoute()),
    ),
    { initialValue: this.getPanelItemsFromRoute() },
  );

  protected readonly hasPanelItems = computed(() => this.panelItems().length > 0);

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

  protected handleNavItemEnter(route: string): void {
    this.suppressHoverTooltip.set(false);
    this.hoveredItemRoute.set(route);
  }

  protected handleNavItemLeave(route: string): void {
    if (this.hoveredItemRoute() !== route) return;
    this.hoveredItemRoute.set(null);
  }

  protected handleNavItemClick(): void {
    this.suppressHoverTooltip.set(true);
    this.hoveredItemRoute.set(null);
  }

  protected isTooltipVisible(route: string): boolean {
    return !this.suppressHoverTooltip() && this.hoveredItemRoute() === route;
  }

  protected handleProfileMenuSelection(item: MenuItem): void {
    if (item.label !== 'menu.signOut') return;
    this.authService.signOut().subscribe({
      next: () => {
        this.router.navigate(['/sign-in']);
      },
      error: () => {
        this.tokens.clear();
        this.router.navigate(['/sign-in']);
      },
    });
  }
}
