import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'shared-page-layout',
  templateUrl: './page-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLayoutComponent {
  title = input<string>('');
  subtitle = input<string>('');
  error = input<string | null>(null);
  removeMobilePadding = input<boolean>(false);
}
