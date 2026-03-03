import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Lead, LeadStatus, PipelineStage } from '../../../core/services/leads.types';
import type { SelectOption } from '../../../shared/components/select/select.component';
import type { ChipVariant } from '../../../shared/components/chip/chip.component';
import { LeadDetailHeaderComponent } from './lead-detail-header.component';
import { LeadQuickActionsComponent } from './lead-quick-actions.component';

@Component({
  selector: 'app-lead-detail-top-section',
  templateUrl: './lead-detail-top-section.component.html',
  styleUrl: './lead-detail-top-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LeadDetailHeaderComponent, LeadQuickActionsComponent],
})
export class LeadDetailTopSectionComponent {
  lead = input<Lead | null>(null);
  fullName = input<string>('');
  serviceTypeLabel = input<string | null>(null);
  status = input<LeadStatus | null>(null);
  pipelineStage = input<PipelineStage | null>(null);
  noServiceLabel = input<string>('');
  statusMenuOpen = input(false);
  statusOptions = input<SelectOption<LeadStatus>[]>([]);
  selectedStatus = input<LeadStatus | null>(null);
  statusLabelMap = input<Partial<Record<LeadStatus, string>>>({} as Partial<Record<LeadStatus, string>>);
  energyLabelClass = input<string | null>(null);
  energyLabelVariant = input<ChipVariant>('neutral');
  phone = input<string | null>(null);
  email = input<string | null>(null);
  hasSelectedService = input(false);

  back = output<void>();
  toggleStatusMenu = output<void>();
  closeStatusMenu = output<void>();
  selectStatus = output<LeadStatus>();
  createQuote = output<void>();
  editLead = output<void>();
  callClicked = output<void>();
  emailClicked = output<void>();
  navigateClicked = output<void>();
  logCallClicked = output<void>();
  quoteClicked = output<void>();
}
