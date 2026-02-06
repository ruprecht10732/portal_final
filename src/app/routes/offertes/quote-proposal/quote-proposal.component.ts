import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { interval, filter, switchMap } from 'rxjs';

import { PublicQuoteService } from '../../../core/services/public-quote.service';
import type {
  PublicQuoteResponse,
  PublicQuoteItemResponse,
  AnnotationResponse,
  VatBreakdown,
} from '../../../core/services/quotes.types';
import { centsToEuros, QUOTE_STATUS_COLORS } from '../../../core/services/quotes.types';
import { SignaturePadComponent } from '../../../shared/components/signature-pad/signature-pad.component';

@Component({
  selector: 'app-quote-proposal',
  imports: [FormsModule, DatePipe, NgClass, SignaturePadComponent],
  templateUrl: './quote-proposal.component.html',
  styleUrl: './quote-proposal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicQuoteService = inject(PublicQuoteService);
  private readonly destroyRef = inject(DestroyRef);

  // State signals
  protected readonly loading = signal(true);
  protected readonly quote = signal<PublicQuoteResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly toggling = signal<string | null>(null); // itemId being toggled
  protected readonly accepting = signal(false);
  protected readonly rejecting = signal(false);

  // Accept form
  protected readonly signatureName = signal('');
  protected readonly signatureData = signal<string | null>(null);
  protected readonly showAcceptDialog = signal(false);
  protected readonly showRejectDialog = signal(false);
  protected readonly rejectReason = signal('');

  // Annotation form
  protected readonly annotatingItemId = signal<string | null>(null);
  protected readonly annotationText = signal('');
  protected readonly submittingAnnotation = signal(false);

  // Derived
  protected readonly token = signal('');
  protected readonly isFinalized = computed(() => {
    const q = this.quote();
    return q?.status === 'Accepted' || q?.status === 'Rejected' || q?.status === 'Expired';
  });
  protected readonly isExpired = computed(() => {
    const q = this.quote();
    if (!q?.validUntil) return false;
    return new Date(q.validUntil) < new Date();
  });
  protected readonly statusColor = computed(() => {
    const q = this.quote();
    return q ? (QUOTE_STATUS_COLORS[q.status] ?? '') : '';
  });

  ngOnInit(): void {
    const t = this.route.snapshot.paramMap.get('token');
    if (!t) {
      this.error.set('Geen geldig offerte-link gevonden.');
      this.loading.set(false);
      return;
    }
    this.token.set(t);
    this.loadQuote(t);
    this.startAnnotationPolling(t);
  }

  /**
   * Poll the quote every 10 s while the quote is still in "Sent" status,
   * so agent replies and toggle changes appear in near-real-time.
   */
  private startAnnotationPolling(token: string): void {
    interval(10_000)
      .pipe(
        filter(() => !this.isFinalized() && !this.loading()),
        switchMap(() => this.publicQuoteService.getByToken(token)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: updated => this.quote.set(updated),
      });
  }

  private loadQuote(token: string): void {
    this.loading.set(true);
    this.publicQuoteService.getByToken(token).subscribe({
      next: quote => {
        this.quote.set(quote);
        this.loading.set(false);
      },
      error: err => {
        if (err.status === 410) {
          this.error.set('Deze offerte-link is verlopen.');
        } else if (err.status === 404) {
          this.error.set('Offerte niet gevonden.');
        } else {
          this.error.set('Er ging iets mis bij het laden van de offerte.');
        }
        this.loading.set(false);
      },
    });
  }

  protected toggleItem(item: PublicQuoteItemResponse): void {
    if (this.isFinalized() || !item.isOptional) return;

    const t = this.token();
    this.toggling.set(item.id);

    this.publicQuoteService.toggleItem(t, item.id, !item.isSelected).subscribe({
      next: result => {
        // Update item selection in local state
        const q = this.quote();
        if (q) {
          const updatedItems = q.items.map(i =>
            i.id === item.id ? { ...i, isSelected: !i.isSelected } : i,
          );
          this.quote.set({
            ...q,
            items: updatedItems,
            subtotalCents: result.subtotalCents,
            discountAmountCents: result.discountAmountCents,
            taxTotalCents: result.taxTotalCents,
            totalCents: result.totalCents,
            vatBreakdown: result.vatBreakdown,
          });
        }
        this.toggling.set(null);
      },
      error: () => {
        this.toggling.set(null);
      },
    });
  }

  protected startAnnotation(itemId: string): void {
    this.annotatingItemId.set(itemId);
    this.annotationText.set('');
  }

  protected cancelAnnotation(): void {
    this.annotatingItemId.set(null);
    this.annotationText.set('');
  }

  protected submitAnnotation(itemId: string): void {
    const text = this.annotationText().trim();
    if (!text) return;

    this.submittingAnnotation.set(true);

    this.publicQuoteService.annotateItem(this.token(), itemId, text).subscribe({
      next: annotation => {
        // Add annotation to the item in local state
        const q = this.quote();
        if (q) {
          const updatedItems = q.items.map(i =>
            i.id === itemId
              ? { ...i, annotations: [...i.annotations, annotation] }
              : i,
          );
          this.quote.set({ ...q, items: updatedItems });
        }
        this.annotatingItemId.set(null);
        this.annotationText.set('');
        this.submittingAnnotation.set(false);
      },
      error: () => {
        this.submittingAnnotation.set(false);
      },
    });
  }

  protected openAcceptDialog(): void {
    this.showAcceptDialog.set(true);
    this.signatureName.set('');
    this.signatureData.set(null);
  }

  protected onSignatureChange(data: string | null): void {
    this.signatureData.set(data);
  }

  protected closeAcceptDialog(): void {
    this.showAcceptDialog.set(false);
  }

  protected acceptQuote(): void {
    const name = this.signatureName().trim();
    const sigData = this.signatureData();
    if (!name || !sigData) return;

    this.accepting.set(true);
    this.publicQuoteService.accept(this.token(), {
      signatureName: name,
      signatureData: sigData,
    }).subscribe({
      next: updated => {
        this.quote.set(updated);
        this.showAcceptDialog.set(false);
        this.accepting.set(false);
      },
      error: () => {
        this.accepting.set(false);
      },
    });
  }

  protected openRejectDialog(): void {
    this.showRejectDialog.set(true);
    this.rejectReason.set('');
  }

  protected closeRejectDialog(): void {
    this.showRejectDialog.set(false);
  }

  protected rejectQuote(): void {
    this.rejecting.set(true);
    this.publicQuoteService.reject(this.token(), {
      reason: this.rejectReason().trim() || undefined,
    }).subscribe({
      next: updated => {
        this.quote.set(updated);
        this.showRejectDialog.set(false);
        this.rejecting.set(false);
      },
      error: () => {
        this.rejecting.set(false);
      },
    });
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

  protected getItemAnnotations(item: PublicQuoteItemResponse): AnnotationResponse[] {
    return item.annotations ?? [];
  }

  protected getVatBreakdown(): VatBreakdown[] {
    return this.quote()?.vatBreakdown ?? [];
  }

  protected trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
