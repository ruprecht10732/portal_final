import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { SidebarPanelItem } from './sidebar-panel.config';

interface MobileNavItem {
  label: string;
  route: string;
  icon: 'dashboard' | 'leads' | 'profile';
}

@Component({
  selector: 'app-authenticated-mobile-nav',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule, ButtonComponent, TranslatePipe],
  styles: `:host { display: contents; }`,
  template: `
    @if (showSectionMenu()) {
      <div
        class="fixed bottom-16 left-0 right-0 z-50 rounded-t-2xl border-t border-zinc-200 bg-white px-4 py-4 lg:hidden"
        [attr.aria-label]="'sidebar.quickLinks' | translate"
      >
        <div class="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-200"></div>
        <div class="grid gap-2">
          @for (item of panelItems(); track item.route) {
            <shared-button
              size="compact"
              [fullWidth]="true"
              [uppercase]="false"
              [variant]="isRouteActive(item.route, item.exact ?? false) ? 'primary' : 'secondary'"
              [ariaLabel]="item.label | translate"
              (clicked)="navigateTo(item.route)"
            >
              @if (item.icon) {
                <lucide-icon [name]="item.icon" class="h-4 w-4"></lucide-icon>
              }
              {{ item.label | translate }}
            </shared-button>
          }
        </div>
      </div>
    }
    <nav
      class="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center gap-2 border-t border-zinc-200 bg-white px-2 lg:hidden"
      [attr.aria-label]="'sidebar.mobileNavigation' | translate"
    >
      @for (item of items; track item.route) {
        <shared-button
          class="flex-1"
          [fullWidth]="true"
          variant="ghost"
          size="compact"
          [active]="activeLink.isActive"
          [stacked]="true"
          [uppercase]="false"
          [ariaLabel]="item.label | translate"
          [routerLink]="item.route"
          routerLinkActive
          #activeLink="routerLinkActive"
        >
          @switch (item.icon) {
            @case ('dashboard') {
              <lucide-icon name="layout-dashboard" class="h-5 w-5"></lucide-icon>
            }
            @case ('leads') {
              <lucide-icon name="users" class="h-5 w-5"></lucide-icon>
            }
            @case ('profile') {
              <lucide-icon name="user" class="h-5 w-5"></lucide-icon>
            }
          }
          <span class="text-[10px]">{{ item.label | translate }}</span>
        </shared-button>
      }
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedMobileNavComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly items: MobileNavItem[] = [
    { label: 'navigation.dashboard', route: '/app/dashboard', icon: 'dashboard' },
    { label: 'navigation.leads', route: '/app/leads', icon: 'leads' },
    { label: 'navigation.profile', route: '/app/profile', icon: 'profile' },
  ];

  protected readonly panelItems = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.getPanelItemsFromRoute()),
    ),
    { initialValue: this.getPanelItemsFromRoute() },
  );

  protected readonly showSectionMenu = computed(() => this.panelItems().length > 0);

  protected navigateTo(route: string): void {
    this.router.navigateByUrl(route);
  }

  protected isRouteActive(route: string, exact: boolean): boolean {
    const current = this.currentUrl();
    return exact ? current === route : current.startsWith(route);
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
}
