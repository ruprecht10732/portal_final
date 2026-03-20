import type { Lead } from '../../../core/services/leads.types';
import type { AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';

export const CREATE_LEAD_OPTION_VALUE = '__create_new_lead__';

export interface LeadSelectionState {
  selectedLeadServiceId: string | null;
  leadSearchLabel: string;
}

export function formatLeadAutocompleteLabel(lead: Lead): string {
  return `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`;
}

export function buildCreateLeadOption(label: string): AutocompleteOption {
  return { label, value: CREATE_LEAD_OPTION_VALUE };
}

export function buildLeadAutocompleteOptions(
  leads: Lead[],
  createLeadOption: AutocompleteOption,
): AutocompleteOption[] {
  return [
    ...leads.map((lead) => ({ label: formatLeadAutocompleteLabel(lead), value: lead.id })),
    createLeadOption,
  ];
}

export function deriveLeadSelectionState(
  lead: Lead,
  preferredServiceId?: string,
): LeadSelectionState {
  const selectedLeadServiceId =
    preferredServiceId && lead.services?.some((service) => service.id === preferredServiceId)
      ? preferredServiceId
      : (lead.services?.[0]?.id ?? null);

  return {
    selectedLeadServiceId,
    leadSearchLabel: formatLeadAutocompleteLabel(lead),
  };
}