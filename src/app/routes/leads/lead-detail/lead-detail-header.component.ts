import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Lead, LeadStatus, PipelineStage } from '../../../core/services/leads.types';
import type { SelectOption } from '../../../shared/components/select/select.component';
import { ChipComponent, type ChipVariant } from '../../../shared/components/chip/chip.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-lead-detail-header',
  templateUrl: './lead-detail-header.component.html',
  styleUrl: './lead-detail-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent, TranslatePipe, ButtonComponent, StatusBadgeComponent],
})
export class LeadDetailHeaderComponent {
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
  back = output<void>();
  toggleStatusMenu = output<void>();
  closeStatusMenu = output<void>();
  selectStatus = output<LeadStatus>();
  createQuote = output<void>();
  editLead = output<void>();
}
