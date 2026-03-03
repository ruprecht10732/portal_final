import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { KpiSparklineComponent } from '../kpi-sparkline/kpi-sparkline.component';

@Component({
  selector: 'shared-kpi-card',
  imports: [KpiSparklineComponent],
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
  trend = input<number[]>([]);
  isLoading = input(false);

  protected readonly hostClass = computed(() => {
    return 'block';
  });
}
