import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { QuotesService } from '../../../core/services/quotes.service';
import { LeadsService } from '../../../core/services/leads.service';
import type { Quote, QuoteStatus } from '../../../core/services/quotes.types';
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS } from '../../../core/services/quotes.types';
import type { Lead } from '../../../core/services/leads.types';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';

interface QuoteWithLead extends Quote {
  lead?: Lead;
}

@Component({
  selector: 'app-offertes-list',
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent, SelectComponent],
  templateUrl: './offertes-list.component.html',
  styleUrl: './offertes-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffertesListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly quotesService = inject(QuotesService);
  private readonly leadsService = inject(LeadsService);

  protected readonly loading = signal(true);
  protected readonly quotes = signal<QuoteWithLead[]>([]);
  protected readonly statusFilter = signal<QuoteStatus | 'all'>('all');

  protected readonly statusOptions = computed<SelectOption<QuoteStatus | 'all'>[]>(() => [
    { label: 'All', value: 'all' },
    { label: QUOTE_STATUS_LABELS.draft, value: 'draft' },
    { label: QUOTE_STATUS_LABELS.sent, value: 'sent' },
    { label: QUOTE_STATUS_LABELS.accepted, value: 'accepted' },
    { label: QUOTE_STATUS_LABELS.rejected, value: 'rejected' },
    { label: QUOTE_STATUS_LABELS.expired, value: 'expired' },
  ]);

  protected readonly filteredQuotes = computed(() => {
    const filter = this.statusFilter();
    const all = this.quotes();
    if (filter === 'all') return all;
    return all.filter(q => q.status === filter);
  });

  ngOnInit(): void {
    this.loadQuotes();
  }

  private loadQuotes(): void {
    this.loading.set(true);
    this.quotesService
      .list()
      .pipe(switchMap(response => this.loadLeadsForQuotes(response.items)))
      .subscribe({
        next: quotesWithLeads => {
          this.quotes.set(quotesWithLeads);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  private loadLeadsForQuotes(items: Quote[]): Observable<QuoteWithLead[]> {
    const leadIds = [...new Set(items.map(q => q.leadId))];
    if (leadIds.length === 0) return of([]);

    return forkJoin(
      leadIds.map(id =>
        this.leadsService.getById(id).pipe(
          map(lead => ({ id, lead })),
          catchError(() => of({ id, lead: undefined }))
        )
      )
    ).pipe(
      map(results => {
        const leadsMap = new Map<string, Lead | undefined>(results.map(result => [result.id, result.lead]));
        return items.map(q => ({
          ...q,
          lead: leadsMap.get(q.leadId),
        }));
      })
    );
  }

  protected setStatusFilter(value: QuoteStatus | 'all' | null): void {
    if (value) this.statusFilter.set(value);
  }

  protected createQuote(): void {
    this.router.navigate(['/app/offertes/new']);
  }

  protected viewQuote(id: string): void {
    this.router.navigate(['/app/offertes', id]);
  }

  protected getStatusLabel(status: QuoteStatus): string {
    return QUOTE_STATUS_LABELS[status];
  }

  protected getStatusColor(status: QuoteStatus): string {
    return QUOTE_STATUS_COLORS[status];
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
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }
}
