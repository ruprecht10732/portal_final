import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthenticatedSidebarNavItemComponent } from './authenticated-sidebar-nav-item.component';
import { SidebarPanelItem } from './sidebar-panel.config';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-authenticated-sidebar-panel',
  imports: [AuthenticatedSidebarNavItemComponent, TranslatePipe, LucideAngularModule, RouterLink],
  templateUrl: './authenticated-sidebar-panel.component.html',
  styleUrl: './authenticated-sidebar-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedSidebarPanelComponent {
  title = input('');
  items = input<readonly SidebarPanelItem[]>([]);

  protected shouldShowGroupHeading(index: number): boolean {
    const items = this.items();
    const currentGroup = items[index]?.group?.trim();
    if (!currentGroup) {
      return false;
    }

    const previousGroup = items[index - 1]?.group?.trim();
    return index === 0 || previousGroup !== currentGroup;
  }
}
