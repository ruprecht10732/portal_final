import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule
} from 'lucide-angular';
import { filter, map } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MenuComponent, MenuSection } from '../../shared/components/menu/menu.component';
import { AuthenticatedSidebarPanelComponent } from './authenticated-sidebar-panel.component';
import { SidebarPanelItem } from './sidebar-panel.config';

interface SidebarItem {
  label: string;
  route: string;
  icon: 'dashboard' | 'leads' | 'profile';
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
  ],
  templateUrl: './authenticated-sidebar.component.html',
  styleUrl: './authenticated-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedSidebarComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isExpanded = signal(true);

  protected readonly items: SidebarItem[] = [
    { label: 'Dashboard', route: '/app/dashboard', icon: 'dashboard' },
    { label: 'Leads', route: '/app/leads', icon: 'leads' },
    { label: 'Profile', route: '/app/profile', icon: 'profile' },
  ];

  protected readonly profileMenu: MenuSection[] = [
    {
      label: 'Account',
      items: [
        { label: 'Profile', route: '/app/profile' },
        { label: 'Sign out', route: '/sign-in' },
      ],
    },
  ];

  protected readonly activeTitle = computed(() => {
    const url = this.currentUrl();
    return this.items.find((item) => url.startsWith(item.route))?.label ?? '';
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
