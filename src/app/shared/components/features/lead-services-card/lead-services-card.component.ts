import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import type { LeadService, LeadStatus } from '../../../../core/services/leads.types';
import type { SelectOption } from '../../select/select.component';
import { CardComponent } from '../../card/card.component';
import { CheckboxComponent } from '../../checkbox/checkbox.component';
import { InputComponent } from '../../input/input.component';
import { SelectComponent } from '../../select/select.component';
import { TextareaComponent } from '../../textarea/textarea.component';

@Component({
  selector: 'shared-lead-services-card',
  templateUrl: './lead-services-card.component.html',
  styleUrl: './lead-services-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, CheckboxComponent, DatePipe, DecimalPipe, InputComponent, SelectComponent, TextareaComponent, TranslatePipe],
})
export class LeadServicesCardComponent {
  services = input<LeadService[]>([]);
  selectedServiceId = input<string | null>(null);
  serviceTypeLabels = input<Record<string, string>>({} as Record<string, string>);
  statusLabels = input<Record<LeadStatus, string>>({} as Record<LeadStatus, string>);
  statusColors = input<Record<LeadStatus, string>>({} as Record<LeadStatus, string>);

  showAddForm = input(false);
  serviceTypeOptions = input<SelectOption<string>[]>([]);
  newServiceType = input<string | null>(null);
  newServiceConsumerNote = input('');
  newServiceSource = input('');
  closeCurrentService = input(true);
  saving = input(false);

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

  protected isSelected(service: LeadService): boolean {
    return service.id === this.selectedServiceId();
  }

  protected isEditing(service: LeadService): boolean {
    return service.id === this.editingServiceTypeId();
  }
}
