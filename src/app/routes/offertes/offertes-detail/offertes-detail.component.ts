import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

import { QuotesService } from '../../../core/services/quotes.service';
import { LeadsService } from '../../../core/services/leads.service';
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

  protected readonly loading = signal(true);
  protected readonly quote = signal<QuoteResponse | null>(null);
  protected readonly lead = signal<Lead | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly updating = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadQuote(id);
    } else {
      this.router.navigate(['/app/offertes']);
    }
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
