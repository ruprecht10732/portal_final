import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule
} from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, filter, map, of } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MenuComponent, MenuSection } from '../../shared/components/menu/menu.component';
import { AuthenticatedSidebarPanelComponent } from './authenticated-sidebar-panel.component';
import { SidebarPanelItem } from './sidebar-panel.config';
import { UserService } from '../../core/services/user.service';
import type { UserProfile } from '../../core/services/user.types';

interface SidebarItem {
  label: string;
  route: string;
  icon: 'dashboard' | 'leads' | 'services' | 'profile';
}

@Component({
  selector: 'app-authenticated-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    ButtonComponent,
    MenuComponent,
    LucideAngularModule,
    AuthenticatedSidebarPanelComponent,
    TranslatePipe,
  ],
  templateUrl: './authenticated-sidebar.component.html',
  styleUrl: './authenticated-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedSidebarComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isExpanded = signal(true);

  private readonly user = toSignal(
    this.userService.getProfile().pipe(
      catchError(() => of(null)),
    ),
    { initialValue: null as UserProfile | null },
  );

  protected readonly isAdmin = computed(() => this.user()?.roles?.includes('admin') ?? false);

  protected readonly items = computed<SidebarItem[]>(() => {
    const base: SidebarItem[] = [
      { label: 'navigation.dashboard', route: '/app/dashboard', icon: 'dashboard' },
      { label: 'navigation.leads', route: '/app/leads', icon: 'leads' },
      { label: 'navigation.profile', route: '/app/profile', icon: 'profile' },
    ];
    if (this.isAdmin()) {
      base.splice(2, 0, { label: 'navigation.services', route: '/app/services', icon: 'services' });
    }
    return base;
  });

  protected readonly profileMenu: MenuSection[] = [
    {
      label: 'menu.account',
      items: [
        { label: 'navigation.profile', route: '/app/profile' },
        { label: 'menu.signOut', route: '/sign-in' },
      ],
    },
  ];

  protected readonly activeTitle = computed(() => {
    const url = this.currentUrl();
    return this.items().find((item: SidebarItem) => url.startsWith(item.route))?.label ?? '';
  });

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
}
