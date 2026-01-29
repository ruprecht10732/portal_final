import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

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
  protected readonly items: MobileNavItem[] = [
    { label: 'Dashboard', route: '/app/dashboard', icon: 'dashboard' },
    { label: 'Leads', route: '/app/leads', icon: 'leads' },
    { label: 'Profile', route: '/app/profile', icon: 'profile' },
  ];
}
