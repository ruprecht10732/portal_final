import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Lead, LeadService } from '../../../core/services/leads.types';

@Component({
  selector: 'app-lead-inquiry-card',
  templateUrl: './lead-inquiry-card.component.html',
  styleUrl: './lead-inquiry-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class LeadInquiryCardComponent {
  lead = input<Lead | null>(null);
  selectedService = input<LeadService | null>(null);

  protected readonly sourceLabel = computed(() => {
    const value = this.lead()?.source?.trim();
    return value ?? null;
  });

  protected readonly noteText = computed(() => {
    // Use selected service if provided, otherwise fall back to currentService
    const service = this.selectedService() ?? this.lead()?.currentService;
    const value = service?.consumerNote?.trim();
    return value ?? null;
  });
}
