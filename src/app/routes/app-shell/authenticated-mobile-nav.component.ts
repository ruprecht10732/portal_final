import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { filter, map } from 'rxjs';
import { SidebarPanelItem } from './sidebar-panel.config';

interface MobileNavItem {
  label: string;
  route: string;
  icon: 'dashboard' | 'leads' | 'profile';
}

@Component({
  selector: 'app-authenticated-mobile-nav',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  styles: `:host { display: contents; }`,
  template: `
    @if (showSectionMenu()) {
      <div
        class="fixed bottom-16 left-0 right-0 z-50 border-t border-zinc-200 bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.35)] lg:hidden"
        aria-label="Section navigation"
      >
        <div class="mb-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-400">Section</div>
        <div class="flex items-center gap-2 overflow-x-auto pb-1">
          @for (item of panelItems(); track item.route) {
            <a
              [routerLink]="item.route"
              class="flex items-center gap-2 whitespace-nowrap rounded-full border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:text-zinc-900"
            >
              @if (item.icon) {
                <lucide-icon [name]="item.icon" class="h-4 w-4"></lucide-icon>
              }
              {{ item.label }}
            </a>
          }
        </div>
      </div>
    }
    <nav
      class="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-zinc-200 bg-white lg:hidden"
      aria-label="Mobile navigation"
    >
      @for (item of items; track item.route) {
        <a
          [routerLink]="item.route"
          routerLinkActive
          #activeLink="routerLinkActive"
          class="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors"
          [class.text-zinc-900]="activeLink.isActive"
          [class.text-zinc-400]="!activeLink.isActive"
          [attr.aria-current]="activeLink.isActive ? 'page' : null"
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
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedMobileNavComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly items: MobileNavItem[] = [
    { label: 'Dashboard', route: '/app/dashboard', icon: 'dashboard' },
    { label: 'Leads', route: '/app/leads', icon: 'leads' },
    { label: 'Profile', route: '/app/profile', icon: 'profile' },
  ];

  protected readonly panelItems = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.getPanelItemsFromRoute()),
    ),
    { initialValue: this.getPanelItemsFromRoute() },
  );

  protected readonly showSectionMenu = computed(() => this.panelItems().length > 0);

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
