import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'shared-page-layout',
  templateUrl: './page-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-hidden' },
})
export class PageLayoutComponent {
  title = input<string>('');
  subtitle = input<string>('');
  error = input<string | null>(null);
  removeMobilePadding = input<boolean>(false);
}
