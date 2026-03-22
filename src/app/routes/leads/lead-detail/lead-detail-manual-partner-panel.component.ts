import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import type { OfferResponse } from '../../../core/services/partners.types';
import type { QuoteResponse } from '../../../core/services/quotes.types';

@Component({
  selector: 'app-lead-detail-manual-partner-panel',
  templateUrl: './lead-detail-manual-partner-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AutocompleteComponent, ButtonComponent, CardComponent, NumberInputComponent, TranslatePipe, FormsModule],
})
export class LeadDetailManualPartnerPanelComponent {
  acceptedOffer = input<OfferResponse | null>(null);
  acceptedOfferLoading = input(false);
  acceptedOfferError = input<string | null>(null);
  acceptedQuote = input<QuoteResponse | null>(null);
  acceptedQuoteLoading = input(false);
  acceptedQuoteError = input<string | null>(null);
  partnerSearch = input('');
  partnerOptions = input<AutocompleteOption[]>([]);
  partnerSearchLoading = input(false);
  partnerSearchError = input<string | null>(null);
  expiresInHours = input(12);
  jobSummaryShort = input('');
  marginPercent = input(10);
  vakmanPriceOverrideEuros = input<number | null>(null);
  selectedItemIds = input<string[]>([]);
  offerError = input<string | null>(null);
  offerCreating = input(false);
  canCreateOffer = input(false);
  selectedPartnerId = input<string | null>(null);
  hasSelectedPartner = input(false);
  offerAcceptanceUrl = input<string | null>(null);
  selectedItemsTotalCents = input(0);
  effectiveVakmanPriceCents = input(0);
  formatEuroCents = input<(value: number) => string>(String);

  viewAcceptedOffer = output<void>();
  partnerSearchChange = output<string>();
  partnerSelected = output<string>();
  clearPartnerSearch = output<void>();
  expiresInHoursChange = output<number | null>();
  jobSummaryShortChange = output<string>();
  marginPercentChange = output<number | null>();
  vakmanPriceOverrideEurosChange = output<number | null>();
  toggleItemSelection = output<string>();
  resetVakmanPriceOverride = output<void>();
  createManualOffer = output<void>();
  linkSelectedPartnerToLead = output<void>();
  openOfferWhatsApp = output<void>();

  protected isItemSelected(itemId: string): boolean {
    return this.selectedItemIds().includes(itemId);
  }
}