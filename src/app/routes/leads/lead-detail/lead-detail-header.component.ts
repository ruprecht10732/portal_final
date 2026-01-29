import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Lead, LeadStatus } from '../../../core/services/leads.types';
import type { SelectOption } from '../../../shared/components/select/select.component';
import { ChipComponent } from '../../../shared/components/chip/chip.component';

@Component({
  selector: 'app-lead-detail-header',
  templateUrl: './lead-detail-header.component.html',
  styleUrl: './lead-detail-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent],
})
export class LeadDetailHeaderComponent {
  lead = input<Lead | null>(null);
  fullName = input<string>('');
  serviceTypeLabel = input<string | null>(null);
  statusLabel = input<string>('');
  statusPillClass = input<string>('bg-zinc-100 text-zinc-600');
  statusMenuOpen = input(false);
  statusOptions = input<SelectOption<LeadStatus>[]>([]);
  selectedStatus = input<LeadStatus | null>(null);
  statusLabelMap = input<Partial<Record<LeadStatus, string>>>({} as Partial<Record<LeadStatus, string>>);
  back = output<void>();
  toggleStatusMenu = output<void>();
  closeStatusMenu = output<void>();
  selectStatus = output<LeadStatus>();
}
