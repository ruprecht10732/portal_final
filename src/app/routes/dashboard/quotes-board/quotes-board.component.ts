import { CurrencyPipe, DatePipe } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatFullName, loadAllPages } from '../dashboard.utils';
import { QuotesService } from '../../../core/services/quotes.service';
import { QUOTE_STATUS_COLORS, QuoteResponse, QuoteStatus } from '../../../core/services/quotes.types';
import { ToastService } from '../../../core/services/toast.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

const PAGE_SIZE = 200;
const MAX_AUTO_PAGES = 10;

const QUOTE_STATUS_ORDER: QuoteStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];

const QUOTE_STATUS_I18N_KEYS: Record<QuoteStatus, string> = {
  Draft: 'offertes.status.draft',
  Sent: 'offertes.status.sent',
  Accepted: 'offertes.status.accepted',
  Rejected: 'offertes.status.rejected',
  Expired: 'offertes.status.expired',
};

const ALLOWED_QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  Draft: ['Sent', 'Expired'],
  Sent: ['Accepted', 'Rejected', 'Expired'],
  Accepted: [],
  Rejected: [],
  Expired: [],
};

@Component({
  selector: 'app-quotes-board',
  imports: [TranslatePipe, RouterLink, CurrencyPipe, DatePipe, DragDropModule, PageLayoutComponent],
  templateUrl: './quotes-board.component.html',
  styleUrl: './quotes-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class QuotesBoardComponent {
  private readonly quotesService = inject(QuotesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(true);
  protected readonly items = signal<QuoteResponse[]>([]);
  protected readonly savingQuoteIds = signal<Set<string>>(new Set());
  protected readonly draggingFromStatus = signal<QuoteStatus | null>(null);

  protected readonly columns = computed(() => {
    const grouped = new Map<QuoteStatus, QuoteResponse[]>();

    for (const status of QUOTE_STATUS_ORDER) {
      grouped.set(status, []);
    }

    for (const quote of this.items()) {
      grouped.get(quote.status)?.push(quote);
    }

    return QUOTE_STATUS_ORDER.map(status => ({
      status,
      titleKey: QUOTE_STATUS_I18N_KEYS[status],
      colorClass: QUOTE_STATUS_COLORS[status],
      items: grouped.get(status) ?? [],
    }));
  });

  constructor() {
    this.load();
  }

  protected readonly canEnterColumn = (drag: CdkDrag<QuoteResponse>, drop: CdkDropList<QuoteResponse[]>): boolean => {
    const quote = drag.data;
    if (!quote) {
      return false;
    }

    const fromStatus = quote.status;
    const toStatus = this.parseDropStatus(drop.id);
    if (!toStatus) {
      return false;
    }

    return fromStatus === toStatus || this.isTransitionAllowed(fromStatus, toStatus);
  };

  protected onDrop(event: CdkDragDrop<QuoteResponse[]>): void {
    const quote = event.item.data;
    if (!quote) {
      return;
    }

    const fromStatus = quote.status;
    const toStatus = this.parseDropStatus(event.container.id);
    if (!toStatus || fromStatus === toStatus || !this.isTransitionAllowed(fromStatus, toStatus)) {
      return;
    }

    this.updateQuoteStatus(quote, toStatus);
  }

  protected onDragStarted(quote: QuoteResponse): void {
    this.draggingFromStatus.set(quote.status);
  }

  protected onDragEnded(): void {
    this.draggingFromStatus.set(null);
  }

  protected connectedDropListIds(currentStatus: QuoteStatus): string[] {
    return QUOTE_STATUS_ORDER.filter(status => status !== currentStatus).map(status => this.quoteDropListId(status));
  }

  protected isColumnDimmed(status: QuoteStatus): boolean {
    const draggingFromStatus = this.draggingFromStatus();
    if (!draggingFromStatus) {
      return false;
    }

    if (draggingFromStatus === status) {
      return false;
    }

    return !this.isTransitionAllowed(draggingFromStatus, status);
  }

  protected quoteDropListId(status: QuoteStatus): string {
    return `quote-status-${status}`;
  }

  protected isSavingQuote(quoteId: string): boolean {
    return this.savingQuoteIds().has(quoteId);
  }

  protected trackQuote(index: number, quote: QuoteResponse): string {
    return quote.id || `${index}`;
  }

  protected getCustomerName(quote: QuoteResponse): string {
    return formatFullName(quote.customerFirstName, quote.customerLastName);
  }

  private load(): void {
    this.loading.set(true);
    loadAllPages(params => this.quotesService.list(params), PAGE_SIZE, MAX_AUTO_PAGES)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.items.set(result.items);
          if (result.truncated) {
            this.toast.warning(this.translate.instant('dashboard.boards.partialDataWarning', { maxItems: PAGE_SIZE * MAX_AUTO_PAGES }));
          }
          this.loading.set(false);
        },
        error: () => {
          this.items.set([]);
          this.loading.set(false);
        },
      });
  }

  private updateQuoteStatus(quote: QuoteResponse, toStatus: QuoteStatus): void {
    const quoteId = quote.id;
    if (!quoteId || this.savingQuoteIds().has(quoteId)) {
      return;
    }

    const previousItems = this.items();
    this.savingQuoteIds.update(current => new Set([...current, quoteId]));

    this.items.set(previousItems.map(item => (item.id === quoteId ? { ...item, status: toStatus } : item)));

    this.quotesService
      .updateStatus(quoteId, toStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updatedQuote => {
          this.items.update(current => current.map(item => (item.id === updatedQuote.id ? updatedQuote : item)));
          this.savingQuoteIds.update(current => {
            const next = new Set(current);
            next.delete(quoteId);
            return next;
          });
        },
        error: () => {
          this.items.set(previousItems);
          this.savingQuoteIds.update(current => {
            const next = new Set(current);
            next.delete(quoteId);
            return next;
          });
        },
      });
  }

  private isTransitionAllowed(fromStatus: QuoteStatus, toStatus: QuoteStatus): boolean {
    return ALLOWED_QUOTE_TRANSITIONS[fromStatus].includes(toStatus);
  }

  private parseDropStatus(dropId: string): QuoteStatus | null {
    const prefix = 'quote-status-';
    if (!dropId.startsWith(prefix)) {
      return null;
    }

    const rawStatus = dropId.slice(prefix.length) as QuoteStatus;
    return QUOTE_STATUS_ORDER.includes(rawStatus) ? rawStatus : null;
  }
}