import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'shared-fab-button',
  imports: [ButtonComponent],
  templateUrl: './fab-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabButtonComponent {
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  ariaLabel = input<string | undefined>(undefined);
  clicked = output<MouseEvent>();
}
