import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { map, type Observable } from 'rxjs';

import { QuotesService } from '../../../core/services/quotes.service';
import { QUOTE_STATUS_LABELS, centsToEuros, formatQuoteCustomerName, type QuoteResponse, type QuoteStatus } from '../../../core/services/quotes.types';
import { DEFAULT_PAGE_SIZE, MOBILE_BREAKPOINT } from '../../../core/config';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { DataRequest, DataResponse, GridColumn, GridConfig } from '../../../shared/components/data-grid/data-grid.types';

interface QuoteRow extends QuoteResponse, Record<string, unknown> {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  totalDisplay: string;
}

interface QuoteListParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
  search?: string;
  status?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  validUntilFrom?: string;
  validUntilTo?: string;
  totalFrom?: string;
  totalTo?: string;
}

@Component({
  selector: 'app-offertes-list',
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent, PageLayoutComponent, DataGridComponent],
  templateUrl: './offertes-list.component.html',
  styleUrl: './offertes-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffertesListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly quotesService = inject(QuotesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'nl', translations: {} },
  });

  protected readonly loading = signal(false);
  protected readonly quotes = signal<QuoteRow[]>([]);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  private readonly lastRequest = signal<DataRequest | null>(null);
  private ignoreNextRequest = true;

  protected readonly statusLabels = computed<Record<QuoteStatus, string>>(() => {
    this.lang();
    return {
      Draft: this.translate.instant('offertes.status.draft'),
      Sent: this.translate.instant('offertes.status.sent'),
      Accepted: this.translate.instant('offertes.status.accepted'),
      Rejected: this.translate.instant('offertes.status.rejected'),
      Expired: this.translate.instant('offertes.status.expired'),
    };
  });

  protected readonly statusOptions = computed(() => [
    { label: this.statusLabels().Draft ?? QUOTE_STATUS_LABELS.Draft, value: 'Draft' },
    { label: this.statusLabels().Sent ?? QUOTE_STATUS_LABELS.Sent, value: 'Sent' },
    { label: this.statusLabels().Accepted ?? QUOTE_STATUS_LABELS.Accepted, value: 'Accepted' },
    { label: this.statusLabels().Rejected ?? QUOTE_STATUS_LABELS.Rejected, value: 'Rejected' },
    { label: this.statusLabels().Expired ?? QUOTE_STATUS_LABELS.Expired, value: 'Expired' },
  ]);

  protected readonly columns = computed<GridColumn<QuoteRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'quoteNumber',
        header: this.translate.instant('offertes.list.columns.quoteNumber'),
        field: 'quoteNumber',
        sortable: true,
        filterable: true,
        width: '160px',
      },
      {
        id: 'customerName',
        header: this.translate.instant('offertes.list.columns.customer'),
        field: 'customerName',
        sortable: true,
        filterable: true,
        width: '200px',
      },
      {
        id: 'customerPhone',
        header: this.translate.instant('offertes.list.columns.phone'),
        field: 'customerPhone',
        sortable: true,
        filterable: true,
        width: '150px',
      },
      {
        id: 'customerAddress',
        header: this.translate.instant('offertes.list.columns.address'),
        field: 'customerAddress',
        sortable: true,
        filterable: true,
        width: '220px',
      },
      {
        id: 'status',
        header: this.translate.instant('offertes.list.columns.status'),
        field: 'status',
        sortable: true,
        filterable: true,
        cellType: 'select',
        selectOptions: this.statusOptions(),
        width: '130px',
      },
      {
        id: 'total',
        header: this.translate.instant('offertes.list.columns.total'),
        field: 'totalDisplay',
        sortable: true,
        filterable: true,
        align: 'right',
        width: '120px',
      },
      {
        id: 'validUntil',
        header: this.translate.instant('offertes.list.columns.validUntil'),
        field: 'validUntil',
        sortable: true,
        filterable: true,
        cellType: 'date',
        width: '120px',
      },
      {
        id: 'createdAt',
        header: this.translate.instant('offertes.list.columns.createdAt'),
        field: 'createdAt',
        sortable: true,
        filterable: true,
        cellType: 'date',
        width: '120px',
      },
    ];
  });

  protected readonly gridConfig: Partial<GridConfig<QuoteRow>> = {
    rowIdField: 'id',
    selectable: false,
    cardViewEnabled: true,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    cardTitleField: 'quoteNumber',
    cardSubtitleField: 'customerName',
    cardSecondarySubtitleField: 'totalDisplay',
    cardPreviewFieldCount: 4,
    mobileAddRowEnabled: false,
    rowViewActionEnabled: true,
    rowDeleteActionEnabled: false,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);
  protected readonly gridColumns = computed<GridColumn<Record<string, unknown>>[]>(() =>
    this.columns() as GridColumn<Record<string, unknown>>[]
  );
  protected readonly gridData = computed<Record<string, unknown>[]>(() =>
    this.quotes() as Record<string, unknown>[]
  );
  protected readonly gridConfigAdapter = this.gridConfig as Partial<GridConfig<Record<string, unknown>>>;
  protected readonly fetchDataAdapter = (request: DataRequest): Observable<DataResponse<Record<string, unknown>>> =>
    this.fetchData(request) as Observable<DataResponse<Record<string, unknown>>>;

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.lastRequest.set(this.buildDefaultRequest());
    this.loading.set(true);
    this.quotesService
      .list({ page: 1, pageSize: DEFAULT_PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'desc' })
      .subscribe({
        next: (response) => {
          this.quotes.set(response.items.map(item => this.normalizeQuote(item)));
          this.total.set(response.total);
          this.loading.set(false);
          this.ignoreNextRequest = true;
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('offertes.errors.load'), {
            allowErrorMessage: true,
            allowMessageField: true,
          });
          this.error.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.loading.set(false);
          this.ignoreNextRequest = true;
        },
      });
  }

  protected onDataRequest(request: DataRequest): void {
    if (this.ignoreNextRequest) {
      this.ignoreNextRequest = false;
      return;
    }

    this.lastRequest.set(request);
    this.loading.set(true);
    this.fetchData(request).subscribe({
      next: (response) => {
        this.quotes.set(response.data);
        this.total.set(response.totalItems);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('offertes.errors.load'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected fetchData(request: DataRequest): Observable<DataResponse<QuoteRow>> {
    const params = this.buildListParams(request);

    return this.quotesService.list(params).pipe(
      map(response => ({
        data: response.items.map(item => this.normalizeQuote(item)),
        totalItems: response.total,
        page: response.page,
        pageSize: response.pageSize,
      }))
    );
  }

  private buildListParams(request: DataRequest): QuoteListParams {
    const sortFieldMap: Record<string, string> = {
      quoteNumber: 'quoteNumber',
      customerName: 'customerName',
      customerPhone: 'customerPhone',
      customerAddress: 'customerAddress',
      status: 'status',
      total: 'total',
      validUntil: 'validUntil',
      createdAt: 'createdAt',
    };

    const params: QuoteListParams = {
      page: request.page,
      pageSize: request.pageSize,
      sortBy: sortFieldMap[request.sort?.columnId ?? 'createdAt'] ?? 'createdAt',
      sortOrder: request.sort?.direction || 'desc',
    };

    if (request.searchTerm) {
      params.search = request.searchTerm;
    }

    this.applyFilters(params, request.filters);
    return params;
  }

  private applyFilters(params: QuoteListParams, filters: DataRequest['filters']): void {
    for (const filter of filters) {
      this.applyFilter(params, filter.columnId, filter.value);
    }
  }

  private applyFilter(params: QuoteListParams, columnId: string, value: string): void {
    switch (columnId) {
      case 'status':
        params.status = value;
        break;
      case 'quoteNumber':
      case 'customerName':
      case 'customerPhone':
      case 'customerAddress':
        params.search = value;
        break;
      case 'total': {
        const range = this.parseCurrencyRange(value);
        if (range.from !== undefined) params.totalFrom = range.from.toString();
        if (range.to !== undefined) params.totalTo = range.to.toString();
        break;
      }
      case 'createdAt': {
        const range = this.parseDateRange(value);
        if (range.from) params.createdAtFrom = range.from;
        if (range.to) params.createdAtTo = range.to;
        break;
      }
      case 'validUntil': {
        const range = this.parseDateRange(value);
        if (range.from) params.validUntilFrom = range.from;
        if (range.to) params.validUntilTo = range.to;
        break;
      }
      default:
        break;
    }
  }

  private normalizeQuote(quote: QuoteResponse): QuoteRow {
    const customerName = formatQuoteCustomerName(quote) || this.translate.instant('offertes.unknownLead');
    const customerPhone = quote.customerPhone ?? '';
    const addressParts = [
      quote.customerAddressStreet,
      quote.customerAddressHouseNumber,
      quote.customerAddressZipCode,
      quote.customerAddressCity,
    ].filter((part): part is string => !!part && part.trim().length > 0);

    return {
      ...quote,
      customerName,
      customerPhone,
      customerAddress: addressParts.join(' '),
      totalDisplay: this.formatCurrency(centsToEuros(quote.totalCents)),
    };
  }

  private parseDateRange(value: string): { from?: string; to?: string } {
    const trimmed = value.trim();
    if (!trimmed) return {};

    const separators = ['..', ' to ', ' - ', ','];
    for (const sep of separators) {
      if (trimmed.includes(sep)) {
        const parts = trimmed.split(sep).map(part => part.trim()).filter(Boolean);
        const fromPart = parts[0];
        const toPart = parts[1];
        if (fromPart && toPart) {
          return { from: fromPart, to: toPart };
        }
      }
    }

    return { from: trimmed, to: trimmed };
  }

  private parseCurrencyRange(value: string): { from?: number; to?: number } {
    const trimmed = value.trim();
    if (!trimmed) return {};

    const separators = ['..', ' to ', ' - ', ','];
    for (const sep of separators) {
      if (trimmed.includes(sep)) {
        const parts = trimmed.split(sep).map(part => part.trim()).filter(Boolean);
        const fromPart = parts[0];
        const toPart = parts[1];
        return this.buildCurrencyRange(fromPart, toPart);
      }
    }

    const single = this.parseCurrencyToCents(trimmed);
    return { from: single, to: single };
  }

  private buildCurrencyRange(fromPart?: string, toPart?: string): { from?: number; to?: number } {
    const result: { from?: number; to?: number } = {};
    if (fromPart) {
      result.from = this.parseCurrencyToCents(fromPart);
    }
    if (toPart) {
      result.to = this.parseCurrencyToCents(toPart);
    }
    return result;
  }

  private parseCurrencyToCents(value: string): number {
    const normalized = value.replaceAll(/[^0-9.,-]/g, '').replaceAll(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return Math.round(parsed * 100);
  }

  private buildDefaultRequest(): DataRequest {
    return {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: { columnId: 'createdAt', direction: 'desc' },
      filters: [],
      searchTerm: '',
    };
  }

  protected createQuote(): void {
    this.router.navigate(['/app/offertes/new']);
  }

  protected onQuoteDoubleClick(quote: QuoteRow): void {
    this.router.navigate(['/app/offertes', quote.id]);
  }

  protected onGridRowDoubleClick(row: Record<string, unknown>): void {
    this.onQuoteDoubleClick(row as QuoteRow);
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

}
