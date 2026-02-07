import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { VatBreakdown } from '../../../core/services/quotes.types';
import { centsToEuros } from '../../../core/services/quotes.types';

@Component({
  selector: 'app-quote-proposal-totals',
  templateUrl: './quote-proposal-totals.component.html',
  styleUrl: './quote-proposal-totals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalTotalsComponent {
  readonly subtotalCents = input(0);
  readonly discountAmountCents = input(0);
  readonly vatBreakdown = input<VatBreakdown[]>([]);
  readonly totalCents = input(0);
  readonly variant = input<'mobile' | 'desktop'>('mobile');

  protected formatCents(cents: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(centsToEuros(cents));
  }

  protected formatTaxRate(bps: number): string {
    return `${bps / 100}%`;
  }
}
