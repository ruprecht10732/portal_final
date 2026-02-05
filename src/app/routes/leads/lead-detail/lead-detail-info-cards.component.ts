import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EnergyLabel, Lead, LeadEnrichment, LeadScore, LeadService } from '../../../core/services/leads.types';
import { LeadEnergyLabelCardComponent } from '../../../shared/components/features/energy-label-card/lead-energy-label-card.component';
import { LeadEnrichmentCardComponent } from './lead-enrichment-card.component';

@Component({
  selector: 'app-lead-detail-info-cards',
  templateUrl: './lead-detail-info-cards.component.html',
  styleUrl: './lead-detail-info-cards.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LeadEnergyLabelCardComponent, LeadEnrichmentCardComponent],
})
export class LeadDetailInfoCardsComponent {
  energyLabel = input<EnergyLabel | null>(null);
  leadEnrichment = input<LeadEnrichment | null>(null);
  leadScore = input<LeadScore | null>(null);
  lead = input<Lead | null>(null);
  selectedService = input<LeadService | null>(null);
}
