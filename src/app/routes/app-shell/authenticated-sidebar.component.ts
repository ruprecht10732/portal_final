import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button.component';

interface SidebarItem {
  label: string;
  route: string;
  icon: 'dashboard' | 'leads';
}

@Component({
  selector: 'app-authenticated-sidebar',
  imports: [RouterLink, RouterLinkActive, ButtonComponent],
  templateUrl: './authenticated-sidebar.component.html',
  styleUrl: './authenticated-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedSidebarComponent {
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
}
