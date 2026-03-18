import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { LeadInboxSummary } from '../../../core/services/whatsapp-inbox.types';
import type { Lead, ConsumerRole } from '../../../core/services/leads.types';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';

@Component({
  selector: 'app-whatsapp-inbox-lead-panel',
  imports: [LucideAngularModule, AutocompleteComponent, CheckboxComponent, InputComponent, SelectComponent],
  templateUrl: './whatsapp-inbox-lead-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppInboxLeadPanelComponent {
  linkedLead = input<Lead | null>(null);
  activePhoneNumber = input<string | null>(null);
  selectedConversation = input(false);
  leadRelationshipBusy = input<'link' | 'unlink' | 'create' | null>(null);
  suggestedLead = input<LeadInboxSummary | null>(null);
  showLeadSearchPanel = input(false);
  leadSearchQuery = input('');
  leadSearchResults = input<readonly Lead[]>([]);
  leadSearchLoading = input(false);
  showCreateLeadPanel = input(false);
  createLeadFirstName = input('');
  createLeadLastName = input('');
  createLeadEmail = input('');
  createLeadStreet = input('');
  createLeadHouseNumber = input('');
  createLeadZipCode = input('');
  createLeadCity = input('');
  createLeadConsumerRole = input<ConsumerRole>('Owner');
  createLeadServiceType = input('');
  createLeadWorkflowId = input<string | null>(null);
  createLeadWhatsappOptedIn = input(true);
  createLeadAddressOptions = input<readonly AutocompleteOption[]>([]);
  consumerRoleOptions = input<readonly SelectOption<ConsumerRole>[]>([]);
  serviceTypeOptions = input<readonly SelectOption<string>[]>([]);
  workflowOptions = input<readonly SelectOption<string | null>[]>([]);
  canCreateConversationLead = input(false);

  clearLinkedLead = output<void>();
  unlinkConversationLead = output<void>();
  linkSuggestedLead = output<void>();
  toggleLeadSearchPanel = output<void>();
  openCreateLeadPanel = output<void>();
  leadSearchQueryChange = output<string>();
  searchExistingLeads = output<void>();
  linkConversationLead = output<string>();
  createLeadFirstNameChange = output<string>();
  createLeadLastNameChange = output<string>();
  createLeadEmailChange = output<string>();
  createLeadStreetChange = output<string>();
  createLeadHouseNumberChange = output<string>();
  createLeadZipCodeChange = output<string>();
  createLeadCityChange = output<string>();
  createLeadConsumerRoleChange = output<ConsumerRole>();
  createLeadServiceTypeChange = output<string>();
  createLeadWorkflowIdChange = output<string | null>();
  createLeadWhatsappOptedInChange = output<boolean>();
  createLeadFromConversation = output<void>();
  closeCreateLeadPanel = output<void>();
}
