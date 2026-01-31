import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Lead } from '../../../core/services/leads.types';
import { ChipComponent } from '../../../shared/components/chip/chip.component';

@Component({
  selector: 'app-lead-inquiry-card',
  templateUrl: './lead-inquiry-card.component.html',
  styleUrl: './lead-inquiry-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent, TranslatePipe],
})
export class LeadInquiryCardComponent {
  lead = input<Lead | null>(null);

  protected readonly sourceLabel = computed(() => {
    const value = this.lead()?.source?.trim();
    return value ?? null;
  });

  protected readonly noteText = computed(() => {
    const value = this.lead()?.consumerNote?.trim();
    return value ?? null;
  });
}
