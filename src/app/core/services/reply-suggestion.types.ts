export type ReplySuggestionScenario =
  | 'generic'
  | 'follow_up'
  | 'appointment_reminder'
  | 'appointment_confirmation'
  | 'reschedule_request'
  | 'quote_reminder'
  | 'quote_expiry'
  | 'missing_information'
  | 'photos_or_documents'
  | 'post_visit_follow_up'
  | 'accepted_quote_next_steps'
  | 'delay_update'
  | 'complaint_recovery';

export interface ReplySuggestionScenarioOption {
  value: ReplySuggestionScenario;
  label: string;
  description: string;
}

export interface SuggestReplyRequest {
  scenario?: ReplySuggestionScenario;
  scenarioNotes?: string;
}

export const REPLY_SUGGESTION_SCENARIO_OPTIONS: readonly ReplySuggestionScenarioOption[] = [
  { value: 'generic', label: 'Algemeen antwoord', description: 'Laat AI een normale reply voorstellen op basis van de thread.' },
  { value: 'follow_up', label: 'Follow-up', description: 'Korte opvolging wanneer de klant nog niet heeft gereageerd.' },
  { value: 'appointment_reminder', label: 'Afspraakherinnering', description: 'Herinner de klant aan een geplande afspraak.' },
  { value: 'appointment_confirmation', label: 'Afspraakbevestiging', description: 'Bevestig datum, tijd en praktische details.' },
  { value: 'reschedule_request', label: 'Verzetten afspraak', description: 'Vraag om een afspraak te verplaatsen of stel nieuwe opties voor.' },
  { value: 'quote_reminder', label: 'Offerte follow-up', description: 'Kom terug op een verstuurde offerte zonder te pushen.' },
  { value: 'quote_expiry', label: 'Offerte verloopt', description: 'Waarschuw dat de offerte binnenkort afloopt.' },
  { value: 'missing_information', label: 'Extra info nodig', description: 'Vraag gericht om ontbrekende gegevens.' },
  { value: 'photos_or_documents', label: 'Foto\'s of documenten vragen', description: 'Vraag om foto\'s, bestanden of bijlagen.' },
  { value: 'post_visit_follow_up', label: 'Na afspraak opvolgen', description: 'Volgende stap na bezoek of inspectie.' },
  { value: 'accepted_quote_next_steps', label: 'Vervolg na akkoord', description: 'Leg uit wat de vervolgstappen zijn na een geaccepteerde offerte.' },
  { value: 'delay_update', label: 'Vertraging of update', description: 'Leg een vertraging of wijziging uit en manage verwachtingen.' },
  { value: 'complaint_recovery', label: 'Klacht of herstel', description: 'Erken het probleem en stuur op een nette oplossing.' },
] as const;

export function isNonGenericReplyScenario(value: ReplySuggestionScenario): boolean {
  return value !== 'generic';
}