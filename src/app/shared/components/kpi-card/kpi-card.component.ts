import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CardComponent } from '../card/card.component';

@Component({
  selector: 'shared-kpi-card',
  imports: [CardComponent],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()'
  }
})
export class KpiCardComponent {
  label = input('');
  value = input('');
  hint = input('');
  isLoading = input(false);

  protected readonly hostClass = computed(() => {
    return 'block';
  });
}
