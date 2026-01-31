import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-authenticated-sidebar-nav-item',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule, TranslatePipe],
  templateUrl: './authenticated-sidebar-nav-item.component.html',
  styleUrl: './authenticated-sidebar-nav-item.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedSidebarNavItemComponent {
  label = input.required<string>();
  route = input.required<string>();
  icon = input<string | null>(null);
  exact = input(false);
}
