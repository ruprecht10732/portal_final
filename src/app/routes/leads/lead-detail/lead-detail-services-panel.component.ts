import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { LeadService, LeadStatus } from '../../../core/services/leads.types';
import type { SelectOption } from '../../../shared/components/select/select.component';
import { LeadServicesCardComponent } from '../../../shared/components/features/lead-services-card/lead-services-card.component';

@Component({
  selector: 'app-lead-detail-services-panel',
  templateUrl: './lead-detail-services-panel.component.html',
  styleUrl: './lead-detail-services-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LeadServicesCardComponent],
})
export class LeadDetailServicesPanelComponent {
  services = input<LeadService[]>([]);
  selectedServiceId = input<string | null>(null);
  serviceTypeLabels = input<Record<string, string>>({});
  statusLabels = input<Record<LeadStatus, string>>({} as Record<LeadStatus, string>);
  statusColors = input<Record<LeadStatus, string>>({} as Record<LeadStatus, string>);
  showAddForm = input<boolean>(false);
  serviceTypeOptions = input<SelectOption<string>[]>([]);
  newServiceType = input<string | null>(null);
  newServiceConsumerNote = input<string>('');
  newServiceSource = input<string>('');
  closeCurrentService = input<boolean>(true);
  saving = input<boolean>(false);

  // Service type editing
  editingServiceTypeId = input<string | null>(null);
  editingServiceType = input<string | null>(null);
  savingServiceType = input(false);

  openAdd = output<void>();
  cancelAdd = output<void>();
  addService = output<void>();
  selectService = output<LeadService>();
  newServiceTypeChange = output<string | null>();
  newServiceConsumerNoteChange = output<string>();
  newServiceSourceChange = output<string>();
  closeCurrentServiceChange = output<boolean>();

  // Service type editing outputs
  startEditServiceType = output<LeadService>();
  cancelEditServiceType = output<void>();
  saveServiceType = output<void>();
  editingServiceTypeChange = output<string | null>();

  // Service completion output
  startCompleteService = output<LeadService>();
}
