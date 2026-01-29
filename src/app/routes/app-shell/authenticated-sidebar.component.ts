import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule
} from 'lucide-angular';
import { filter, map } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MenuComponent, MenuSection } from '../../shared/components/menu/menu.component';
import {
  AuthenticatedSidebarPanelComponent,
  SidebarPanelItem,
} from './authenticated-sidebar-panel.component';

interface SidebarItem {
  label: string;
  route: string;
  icon: 'dashboard' | 'leads';
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
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isExpanded = signal(true);

  protected readonly items: SidebarItem[] = [
    {
      label: 'Dashboard',
      route: '/app/dashboard',
      icon: 'dashboard',
    },
    {
      label: 'Leads',
      route: '/app/leads',
      icon: 'leads',
    },
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

  protected readonly leadPanelItems: readonly SidebarPanelItem[] = [
    {
      label: 'Lead overview',
      route: '/app/leads',
      icon: 'list',
      exact: true,
    },
    {
      label: 'Create lead',
      route: '/app/leads/new',
      icon: 'plus',
    },
  ];

  protected readonly activeTitle = computed(() => {
    const url = this.currentUrl();
    return this.items.find((item) => url.startsWith(item.route))?.label ?? '';
  });

  protected readonly isLeadsRoute = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/app/leads');
  });

  protected toggleExpanded(): void {
    this.isExpanded.update((value) => !value);
  }
}
