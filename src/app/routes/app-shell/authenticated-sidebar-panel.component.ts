import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AuthenticatedSidebarNavItemComponent } from './authenticated-sidebar-nav-item.component';

export interface SidebarPanelItem {
  label: string;
  route: string;
  icon?: string | null;
  exact?: boolean;
}

@Component({
  selector: 'app-authenticated-sidebar-panel',
  imports: [AuthenticatedSidebarNavItemComponent],
  templateUrl: './authenticated-sidebar-panel.component.html',
  styleUrl: './authenticated-sidebar-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedSidebarPanelComponent {
  title = input('');
  showLeads = input(false);
  leadItems = input<readonly SidebarPanelItem[]>([]);
}
