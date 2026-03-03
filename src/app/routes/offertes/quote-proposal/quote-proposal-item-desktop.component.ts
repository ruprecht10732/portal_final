import { ChangeDetectionStrategy, Component, computed, inject, input, output, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';

import type { AnnotationResponse, PublicQuoteItemResponse } from '../../../core/services/quotes.types';
import { centsToEuros } from '../../../core/services/quotes.types';
import { QuoteAnnotationListComponent } from './quote-annotation-list.component';

@Component({
  selector: 'app-quote-proposal-item-desktop',
  imports: [QuoteAnnotationListComponent, TranslatePipe],
  templateUrl: './quote-proposal-item-desktop.component.html',
  styleUrl: './quote-proposal-item-desktop.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalItemDesktopComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly item = input.required<PublicQuoteItemResponse>();
  readonly isFinalized = input(false);
  readonly isReadOnly = input(false);
  readonly togglingId = input<string | null>(null);
  readonly hasAgentResponse = input(false);
  readonly deletingId = input<string | null>(null);
  readonly organizationName = input<string>('');

  readonly toggleItem = output<PublicQuoteItemResponse>();
  readonly requestAsk = output<void>();
  readonly requestEdit = output<AnnotationResponse>();
  readonly requestRemove = output<AnnotationResponse>();

  protected readonly canToggle = computed(() => this.item().isOptional && !this.isFinalized() && !this.isReadOnly());

  protected formatCents(cents: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(centsToEuros(cents));
  }

  protected formatTaxRate(bps: number): string {
    return `${bps / 100}%`;
  }

  protected renderDescription(value: string | null | undefined): SafeHtml {
    const source = (value ?? '').trim();
    if (!source) return '';
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, source) ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
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
