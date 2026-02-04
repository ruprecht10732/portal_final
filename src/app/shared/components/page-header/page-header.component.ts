import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'shared-page-header',
  imports: [ButtonComponent, LucideAngularModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  title = input('');
  subtitle = input<string | null>(null);
  backAriaLabel = input('');
  showBack = input(true);

  back = output<void>();
}
