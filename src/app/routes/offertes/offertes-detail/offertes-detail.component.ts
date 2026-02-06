import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

import { QuotesService } from '../../../core/services/quotes.service';
import { LeadsService } from '../../../core/services/leads.service';
import { SSEService } from '../../../core/services/sse.service';
import type { QuoteResponse, QuoteStatus } from '../../../core/services/quotes.types';
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS, centsToEuros } from '../../../core/services/quotes.types';
import type { Lead } from '../../../core/services/leads.types';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-offertes-detail',
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent, ConfirmDialogComponent, PageHeaderComponent],
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

  // SSE activity feed
  protected readonly realtimeEvents = signal<{ type: string; message: string; time: Date }[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadQuote(id);
      this.listenForSSEEvents(id);
    } else {
      this.router.navigate(['/app/offertes']);
    }
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
          case 'quote_viewed':
            message = 'Klant heeft de offerte geopend';
            break;
          case 'quote_item_toggled':
            message = `Klant heeft een item ${payload?.['isSelected'] ? 'ingeschakeld' : 'uitgeschakeld'}`;
            this.loadQuote(quoteId); // refresh totals
            break;
          case 'quote_annotated':
            message = `Nieuwe vraag: "${(payload?.['text'] as string)?.substring(0, 50) ?? ''}"`;
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
        if (updated) this.quote.set(updated);
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

  protected print(): void {
    globalThis.print();
  }

  protected sendProposal(): void {
    const q = this.quote();
    if (!q) return;

    this.sending.set(true);
    this.quotesService.send(q.id).subscribe({
      next: updated => {
        if (updated) this.quote.set(updated);
        this.sending.set(false);
      },
      error: () => {
        this.sending.set(false);
      },
    });
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
}
