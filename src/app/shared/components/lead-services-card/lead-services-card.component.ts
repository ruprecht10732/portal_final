import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { LeadService, LeadStatus, ServiceType } from '../../../core/services/leads.types';
import type { SelectOption } from '../select/select.component';
import { ButtonComponent } from '../button/button.component';
import { CardComponent } from '../card/card.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { SelectComponent } from '../select/select.component';

@Component({
  selector: 'shared-lead-services-card',
  templateUrl: './lead-services-card.component.html',
  styleUrl: './lead-services-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, CheckboxComponent, DatePipe, SelectComponent],
})
export class LeadServicesCardComponent {
  services = input<LeadService[]>([]);
  selectedServiceId = input<string | null>(null);
  serviceTypeLabels = input<Record<ServiceType, string>>({} as Record<ServiceType, string>);
  statusLabels = input<Record<LeadStatus, string>>({} as Record<LeadStatus, string>);
  statusColors = input<Record<LeadStatus, string>>({} as Record<LeadStatus, string>);

  showAddForm = input(false);
  serviceTypeOptions = input<SelectOption<ServiceType>[]>([]);
  newServiceType = input<ServiceType | null>(null);
  closeCurrentService = input(true);
  saving = input(false);

  openAdd = output<void>();
  cancelAdd = output<void>();
  addService = output<void>();
  selectService = output<LeadService>();
  newServiceTypeChange = output<ServiceType | null>();
  closeCurrentServiceChange = output<boolean>();

  protected isSelected(service: LeadService): boolean {
    return service.id === this.selectedServiceId();
  }
}
