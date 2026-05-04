import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  NgZone,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { PublicQuoteService } from '../../../core/services/public-quote.service';
import type {
  PublicQuoteResponse,
  PublicQuoteItemResponse,
  AnnotationResponse,
  VatBreakdown,
  QuoteStatus,
} from '../../../core/services/quotes.types';
import { centsToEuros, QUOTE_STATUS_COLORS } from '../../../core/services/quotes.types';
import { QuoteProposalMobileHeaderComponent } from './quote-proposal-mobile-header.component';
import { QuoteStatusBannerComponent } from './quote-status-banner.component';
import { QuoteProposalItemMobileComponent } from './quote-proposal-item-mobile.component';
import { QuoteProposalItemDesktopComponent } from './quote-proposal-item-desktop.component';
import { QuoteProposalTotalsComponent } from './quote-proposal-totals.component';
import { QuoteProposalActionFooterComponent } from './quote-proposal-action-footer.component';
import { QuoteProposalAskSheetComponent } from './quote-proposal-ask-sheet.component';
import { QuoteProposalAcceptSheetComponent } from './quote-proposal-accept-sheet.component';
import { QuoteProposalRejectSheetComponent } from './quote-proposal-reject-sheet.component';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-quote-proposal',
  imports: [
    FormsModule,
    DatePipe,
    TranslatePipe,
    QuoteProposalMobileHeaderComponent,
    QuoteStatusBannerComponent,
    QuoteProposalItemMobileComponent,
    QuoteProposalItemDesktopComponent,
    QuoteProposalTotalsComponent,
    QuoteProposalActionFooterComponent,
    QuoteProposalAskSheetComponent,
    QuoteProposalAcceptSheetComponent,
    QuoteProposalRejectSheetComponent,
    SafeHtmlPipe,
  ],
  templateUrl: './quote-proposal.component.html',
  styleUrl: './quote-proposal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicQuoteService = inject(PublicQuoteService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private eventSource: EventSource | null = null;

  // State signals
  protected readonly loading = signal(true);
  protected readonly quote = signal<PublicQuoteResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly toggling = signal<string | null>(null); // itemId being toggled
  protected readonly accepting = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly downloadingPdf = signal(false);
  protected readonly pdfDownloadError = signal<string | null>(null);

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
  protected readonly editingAnnotationId = signal<string | null>(null);
  protected readonly deletingAnnotationId = signal<string | null>(null);

  // Derived
  protected readonly token = signal('');
  protected readonly isFinalized = computed(() => {
    const q = this.quote();
    return q?.status === 'Accepted' || q?.status === 'Rejected' || q?.status === 'Expired';
  });
  protected readonly isReadOnly = computed(() => !!this.quote()?.isReadOnly);
  protected readonly customerInitial = computed(() => {
    const name = this.quote()?.customerName?.trim();
    return name ? name.charAt(0).toUpperCase() : 'G';
  });
  protected readonly annotationItem = computed(() => {
    const q = this.quote();
    const id = this.annotatingItemId();
    if (!q || !id) return null;
    return q.items.find(item => item.id === id) ?? null;
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
  protected readonly mobileStatusBadge = computed(() => {
    const q = this.quote();
    if (!q) return 'bg-blue-500 shadow-blue-500/20 ring-blue-50';
    switch (q.status) {
      case 'Accepted':
        return 'bg-green-500 shadow-green-500/20 ring-green-50';
      case 'Rejected':
        return 'bg-red-500 shadow-red-500/20 ring-red-50';
      case 'Expired':
        return 'bg-zinc-400 shadow-zinc-400/20 ring-zinc-100';
      case 'Draft':
        return 'bg-amber-500 shadow-amber-500/20 ring-amber-50';
      default:
        return 'bg-blue-500 shadow-blue-500/20 ring-blue-50';
    }
  });

  ngOnInit(): void {
    const t = this.route.snapshot.paramMap.get('token');
    if (!t) {
      this.error.set(this.translate.instant('offertes.proposal.invalidLink'));
      this.loading.set(false);
      return;
    }
    this.token.set(t);
    this.loadQuote(t, true);
    this.connectSSE(t);

    // Clean up EventSource on destroy
    this.destroyRef.onDestroy(() => this.disconnectSSE());
  }

  /**
   * Connect to the public SSE endpoint so agent replies and state
   * changes arrive in real-time without polling.
   */
  private connectSSE(token: string): void {
    const url = `${environment.apiBaseUrl}/public/quotes/${encodeURIComponent(token)}/events`;

    this.zone.runOutsideAngular(() => {
      const es = new EventSource(url);
      this.eventSource = es;

      // Quote-relevant events trigger a lightweight reload
      for (const evtType of ['quote_annotated', 'quote_item_toggled', 'quote_accepted', 'quote_rejected'] as const) {
        es.addEventListener(evtType, () => {
          this.zone.run(() => this.loadQuote(token));
        });
      }

      es.onerror = () => {
        // EventSource auto-reconnects; nothing extra needed
      };
    });
  }

  private disconnectSSE(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  private loadQuote(token: string, initial = false): void {
    if (initial) {
      this.loading.set(true);
    }
    this.publicQuoteService.getByToken(token).subscribe({
      next: quote => {
        this.quote.set(quote);
        this.loading.set(false);

        // Auto-close dialogs if the quote just became finalized
        if (quote.status === 'Accepted' || quote.status === 'Rejected' || quote.status === 'Expired') {
          this.showAcceptDialog.set(false);
          this.showRejectDialog.set(false);
          this.annotatingItemId.set(null);
        }
      },
      error: err => {
        if (err.status === 410) {
          this.error.set(this.translate.instant('offertes.proposal.expiredLink'));
        } else if (err.status === 404) {
          this.error.set(this.translate.instant('offertes.proposal.notFound'));
        } else {
          this.error.set(this.translate.instant('offertes.proposal.loadError'));
        }
        this.loading.set(false);
      },
    });
  }
  protected statusLabel(status: QuoteStatus): string {
    return this.translate.instant(`offertes.status.${status.toLowerCase()}`);
  }


  protected toggleItem(item: PublicQuoteItemResponse): void {
    if (this.isFinalized() || this.isReadOnly() || !item.isOptional) return;

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

  protected startAnnotation(itemId: string, annotation?: AnnotationResponse): void {
    if (this.isFinalized() || this.isReadOnly()) return;
    this.annotatingItemId.set(itemId);
    this.annotationText.set(annotation?.text ?? '');
    this.editingAnnotationId.set(annotation?.id ?? null);
  }

  protected cancelAnnotation(): void {
    this.annotatingItemId.set(null);
    this.annotationText.set('');
    this.editingAnnotationId.set(null);
  }

  protected submitAnnotation(itemId: string): void {
    if (this.isReadOnly()) return;
    const text = this.annotationText().trim();
    if (!text) return;

    this.submittingAnnotation.set(true);

    const editingId = this.editingAnnotationId();
    const request$ = editingId
      ? this.publicQuoteService.updateAnnotation(this.token(), itemId, editingId, text)
      : this.publicQuoteService.annotateItem(this.token(), itemId, text);

    request$.subscribe({
      next: annotation => {
        const q = this.quote();
        if (q) {
          const updatedItems = q.items.map(i => {
            if (i.id !== itemId) return i;
            const existingAnnotations = i.annotations ?? [];
            if (editingId) {
              return {
                ...i,
                annotations: existingAnnotations.map(a => (a.id === annotation.id ? { ...a, text: annotation.text } : a)),
              };
            }
            return { ...i, annotations: [...existingAnnotations, annotation] };
          });
          this.quote.set({ ...q, items: updatedItems });
        }
        this.annotatingItemId.set(null);
        this.annotationText.set('');
        this.editingAnnotationId.set(null);
        this.submittingAnnotation.set(false);
      },
      error: () => {
        this.submittingAnnotation.set(false);
      },
    });
  }

  protected hasAgentResponse(item: PublicQuoteItemResponse): boolean {
    return (item.annotations ?? []).some(a => a.authorType === 'agent');
  }

  protected deleteAnnotation(itemId: string, annotationId: string): void {
    if (this.isReadOnly() || this.deletingAnnotationId()) return;
    this.deletingAnnotationId.set(annotationId);

    this.publicQuoteService.deleteAnnotation(this.token(), itemId, annotationId).subscribe({
      next: () => {
        const q = this.quote();
        if (q) {
          const updatedItems = q.items.map(i => {
            if (i.id !== itemId) return i;
            const remaining = (i.annotations ?? []).filter(a => a.id !== annotationId);
            return { ...i, annotations: remaining };
          });
          this.quote.set({ ...q, items: updatedItems });
        }
        if (this.editingAnnotationId() === annotationId) {
          this.cancelAnnotation();
        }
        this.deletingAnnotationId.set(null);
      },
      error: () => {
        this.deletingAnnotationId.set(null);
      },
    });
  }

  protected openAcceptDialog(): void {
    if (this.isFinalized() || this.isReadOnly()) return;
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
    if (this.isFinalized() || this.isReadOnly()) return;
    this.showRejectDialog.set(true);
    this.rejectReason.set('');
  }

  protected closeRejectDialog(): void {
    this.showRejectDialog.set(false);
  }

  protected rejectQuote(): void {
    this.rejecting.set(true);
    const reason = this.rejectReason().trim();
    this.publicQuoteService.reject(this.token(), {
      reason,
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

  protected downloadPdf(): void {
    const t = this.token();
    const q = this.quote();
    if (!t || !q) return;

    this.downloadingPdf.set(true);
    this.pdfDownloadError.set(null);
    this.publicQuoteService.downloadPdf(t).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Offerte-${q.quoteNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => {
        this.downloadingPdf.set(false);
        this.pdfDownloadError.set(this.translate.instant('offertes.proposal.downloadError'));
      },
    });
  }

  protected async shareQuote(): Promise<void> {
    const q = this.quote();
    const url = globalThis.location?.href ?? '';
    if (!url) return;

    try {
      const nav = globalThis.navigator;
      if (nav?.share) {
        const shareData: ShareData = q
          ? {
              title: this.translate.instant('offertes.proposal.shareTitle', { number: q.quoteNumber }),
              text: this.translate.instant('offertes.proposal.shareText', { organization: q.organizationName }),
              url,
            }
          : { title: this.translate.instant('offertes.proposal.shareFallbackTitle'), url };
        await nav.share(shareData);
        return;
      }

      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
      }
    } catch {
      // Ignore share failures to avoid blocking the user flow.
    }
  }

  protected trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
