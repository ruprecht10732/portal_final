import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { AnnotationResponse, PublicQuoteItemResponse, PricingMode } from '../../../core/services/quotes.types';
import { centsToEuros } from '../../../core/services/quotes.types';
import { QuoteAnnotationListComponent } from './quote-annotation-list.component';
import { LucideAngularModule } from 'lucide-angular';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-quote-proposal-item-mobile',
  imports: [QuoteAnnotationListComponent, LucideAngularModule, TranslatePipe, SafeHtmlPipe],
  templateUrl: './quote-proposal-item-mobile.component.html',
  styleUrl: './quote-proposal-item-mobile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalItemMobileComponent {
  readonly item = input.required<PublicQuoteItemResponse>();
  readonly pricingMode = input<PricingMode>('exclusive');
  readonly isFinalized = input(false);
  readonly isReadOnly = input(false);
  readonly hasAgentResponse = input(false);
  readonly deletingId = input<string | null>(null);
  readonly organizationName = input<string>('');

  readonly toggleItem = output<PublicQuoteItemResponse>();
  readonly requestAsk = output<void>();
  readonly requestEdit = output<AnnotationResponse>();
  readonly requestRemove = output<AnnotationResponse>();

  protected expanded = signal(false);
  protected isClamped = computed(() => {
    const desc = this.item().description;
    if (!desc) return false;
    const text = desc.replaceAll(/<[^>]*>/g, '');
    return text.length > 120;
  });

  protected toggleExpand(): void {
    this.expanded.update(v => !v);
  }

  protected formatCents(cents: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(centsToEuros(cents));
  }

  protected formatTaxRate(bps: number): string {
    return `${bps / 100}%`;
  }

  protected emitAsk(): void {
    this.requestAsk.emit();
  }

  protected emitEdit(annotation: AnnotationResponse): void {
    this.requestEdit.emit(annotation);
  }

  protected emitRemove(annotation: AnnotationResponse): void {
    this.requestRemove.emit(annotation);
  }
}
