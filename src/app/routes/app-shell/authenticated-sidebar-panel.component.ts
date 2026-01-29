import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AuthenticatedSidebarNavItemComponent } from './authenticated-sidebar-nav-item.component';
import { SidebarPanelItem } from './sidebar-panel.config';

@Component({
  selector: 'app-authenticated-sidebar-panel',
  imports: [AuthenticatedSidebarNavItemComponent],
  templateUrl: './authenticated-sidebar-panel.component.html',
  styleUrl: './authenticated-sidebar-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedSidebarPanelComponent {
  title = input('');
  items = input<readonly SidebarPanelItem[]>([]);
}
