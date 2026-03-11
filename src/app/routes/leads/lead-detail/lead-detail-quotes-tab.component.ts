import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { QuoteResponse, QuoteStatus } from '../../../core/services/quotes.types';

@Component({
  selector: 'app-lead-detail-quotes-tab',
  templateUrl: './lead-detail-quotes-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class LeadDetailQuotesTabComponent {
  quotes = input<QuoteResponse[]>([]);
  quotesLoading = input<boolean>(false);
  quotesError = input<string | null>(null);
  formatHumanDateTime = input<(value: string | undefined | null) => string>((value) => value ?? '-');
  formatEuroCents = input<(value: number) => string>(String);
  quoteStatusLabelKey = input<(status: QuoteStatus) => string>((status) => status);
  quoteStatusClass = input<(status: QuoteStatus) => string>(() => 'bg-zinc-100 text-zinc-600');

  viewQuote = output<string>();

  protected readonly trackByQuoteId = (_index: number, quote: QuoteResponse): string => quote.id;
}