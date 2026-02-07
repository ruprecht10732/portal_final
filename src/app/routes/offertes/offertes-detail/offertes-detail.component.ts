import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

import { QuotesService } from '../../../core/services/quotes.service';
import { LeadsService } from '../../../core/services/leads.service';
import { SSEService } from '../../../core/services/sse.service';
import type { QuoteResponse, QuoteStatus, QuoteActivityResponse } from '../../../core/services/quotes.types';
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS, centsToEuros } from '../../../core/services/quotes.types';
import type { Lead } from '../../../core/services/leads.types';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MenuComponent, type MenuItem, type MenuSection } from '../../../shared/components/menu/menu.component';

@Component({
  selector: 'app-offertes-detail',
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent, ConfirmDialogComponent, PageHeaderComponent, MenuComponent],
  templateUrl: './offertes-detail.component.html',
  styleUrl: './offertes-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffertesDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quotesService = inject(QuotesService);
  private readonly leadsService = inject(LeadsService);
  private readonly translate = inject(TranslateService);
  private readonly sse = inject(SSEService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly quote = signal<QuoteResponse | null>(null);
  protected readonly lead = signal<Lead | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly updating = signal(false);
  protected readonly sending = signal(false);
  protected readonly downloadingPdf = signal(false);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly loadingPreview = signal(false);

  // Reply text per item (keyed by item ID)
  protected readonly replyTexts = signal<Record<string, string>>({});
  protected readonly replyingItemId = signal<string | null>(null);

  // SSE activity feed — starts with persisted history, live events prepend
  protected readonly realtimeEvents = signal<{ type: string; message: string; time: Date }[]>([]);

  protected readonly mobileMenuSections = computed<readonly MenuSection[]>(() => {
    const q = this.quote();
    const previewAvailable = !!this.previewUrl();
    const pdfAvailable = !!q?.pdfFileKey;
    return [
      {
        items: [
          { label: 'Voorbeeld bekijken', disabled: !previewAvailable },
          { label: 'PDF downloaden', disabled: !pdfAvailable },
          { label: 'Verwijderen' },
        ],
      },
    ];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadQuote(id);
      this.loadActivityHistory(id);
      this.listenForSSEEvents(id);
    } else {
      this.router.navigate(['/app/offertes']);
    }
  }

  private loadActivityHistory(quoteId: string): void {
    this.quotesService.getActivities(quoteId).subscribe({
      next: (activities: QuoteActivityResponse[]) => {
        const mapped = activities.map(a => ({
          type: a.eventType,
          message: a.message,
          time: new Date(a.createdAt),
        }));
        this.realtimeEvents.set(mapped);
      },
      error: () => {
        // silently ignore — history is non-critical
      },
    });
  }

  private listenForSSEEvents(quoteId: string): void {
    this.sse.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        const data = event.data;
        const evtQuoteId = (data?.['quoteId'] as string) ?? '';
        if (evtQuoteId !== quoteId) return;

        const payload = data?.['payload'] as Record<string, unknown> | undefined;

        let message = '';
        switch (event.type) {
          case 'quote_sent':
            message = 'Offerte verstuurd naar de klant';
            break;
          case 'quote_viewed':
            message = 'Klant heeft de offerte geopend';
            break;
          case 'quote_item_toggled': {
            const desc = (payload?.['itemDescription'] as string) || 'een item';
            message = `Klant heeft '${desc}' ${payload?.['isSelected'] ? 'ingeschakeld' : 'uitgeschakeld'}`;
            this.loadQuote(quoteId); // refresh totals
            break;
          }
          case 'quote_annotated':
            message = `Nieuwe vraag: "${(payload?.['text'] as string)?.substring(0, 50) ?? ''}"`;
            this.loadQuote(quoteId); // refresh to show new annotations
            break;
          case 'quote_accepted':
            message = `Offerte geaccepteerd door ${typeof payload?.['signatureName'] === 'string' ? payload['signatureName'] : 'klant'}`;
            this.loadQuote(quoteId);
            break;
          case 'quote_rejected':
            message = 'Offerte afgewezen door klant';
            this.loadQuote(quoteId);
            break;
          default:
            return;
        }

        this.realtimeEvents.update(events => [
          { type: event.type, message, time: new Date() },
          ...events.slice(0, 19), // keep last 20
        ]);
      });
  }

  private loadQuote(id: string): void {
    this.loading.set(true);
    this.quotesService.getById(id).subscribe({
      next: quote => {
        if (quote) {
          this.quote.set(quote);
          this.loadPreviewLink(quote);
          this.loadLead(quote.leadId);
        } else {
          this.error.set(this.translate.instant('offertes.errors.notFound'));
          this.loading.set(false);
        }
      },
      error: () => {
        this.error.set(this.translate.instant('offertes.errors.loadQuote'));
        this.loading.set(false);
      },
    });
  }

  private loadLead(id: string): void {
    this.leadsService.getById(id).subscribe({
      next: lead => {
        this.lead.set(lead);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/offertes']);
  }

  protected updateReplyText(itemId: string, text: string): void {
    this.replyTexts.update(prev => ({ ...prev, [itemId]: text }));
  }

  protected submitReply(itemId: string): void {
    const q = this.quote();
    if (!q) return;
    const text = (this.replyTexts()[itemId] ?? '').trim();
    if (!text) return;

    this.replyingItemId.set(itemId);
    this.quotesService.annotateItem(q.id, itemId, text).subscribe({
      next: () => {
        this.replyTexts.update(prev => ({ ...prev, [itemId]: '' }));
        this.replyingItemId.set(null);
        // Reload quote to refresh annotations
        this.loadQuote(q.id);
      },
      error: () => {
        this.replyingItemId.set(null);
      },
    });
  }

  protected handleMobileMenuSelection(item: MenuItem): void {
    switch (item.label) {
      case 'Voorbeeld bekijken':
        this.openPreview();
        break;
      case 'PDF downloaden':
        this.downloadPdf();
        break;
      case 'Verwijderen':
        this.confirmDelete();
        break;
      default:
        break;
    }
  }

  protected editQuote(): void {
    const q = this.quote();
    if (q) {
      this.router.navigate(['/app/offertes', q.id, 'edit']);
    }
  }

  protected updateStatus(status: QuoteStatus): void {
    const q = this.quote();
    if (!q) return;

    this.updating.set(true);
    this.quotesService.updateStatus(q.id, status).subscribe({
      next: updated => {
        if (updated) {
          this.quote.set(updated);
          this.loadPreviewLink(updated);
        }
        this.updating.set(false);
      },
      error: () => {
        this.updating.set(false);
      },
    });
  }

  protected confirmDelete(): void {
    this.showDeleteConfirm.set(true);
  }

  protected cancelDelete(): void {
    this.showDeleteConfirm.set(false);
  }

  protected deleteQuote(): void {
    const q = this.quote();
    if (!q) return;

    this.quotesService.delete(q.id).subscribe({
      next: () => {
        this.router.navigate(['/app/offertes']);
      },
    });
  }

  protected downloadPdf(): void {
    const q = this.quote();
    if (!q?.pdfFileKey) return;

    this.downloadingPdf.set(true);
    this.quotesService.downloadPdf(q.id).subscribe({
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
      },
    });
  }

  protected sendProposal(): void {
    const q = this.quote();
    if (!q) return;

    this.sending.set(true);
    this.quotesService.send(q.id).subscribe({
      next: updated => {
        if (updated) {
          this.quote.set(updated);
          this.loadPreviewLink(updated);
        }
        this.sending.set(false);
      },
      error: () => {
        this.sending.set(false);
      },
    });
  }

  private loadPreviewLink(q: QuoteResponse): void {
    if (q.status === 'Draft') {
      this.previewUrl.set(null);
      this.loadingPreview.set(false);
      return;
    }

    this.loadingPreview.set(true);
    this.quotesService.getPreviewLink(q.id).subscribe({
      next: response => {
        this.previewUrl.set(this.buildPreviewUrl(response.token));
        this.loadingPreview.set(false);
      },
      error: () => {
        this.previewUrl.set(null);
        this.loadingPreview.set(false);
      },
    });
  }

  protected openPreview(): void {
    const url = this.previewUrl();
    if (!url) return;
    globalThis.open(url, '_blank', 'noopener');
  }

  private buildPreviewUrl(token: string): string {
    const origin = globalThis.location?.origin ?? '';
    return origin ? `${origin}/quote/${token}` : `/quote/${token}`;
  }

  protected getStatusLabel(status: QuoteStatus): string {
    return QUOTE_STATUS_LABELS[status];
  }

  protected getStatusColor(status: QuoteStatus): string {
    return QUOTE_STATUS_COLORS[status];
  }

  protected formatCentsCurrency(cents: number): string {
    return this.formatCurrency(centsToEuros(cents));
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  protected formatDate(date: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  }

  protected formatAnnotationDate(date: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }
}
