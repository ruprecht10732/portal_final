import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, map, Observable } from 'rxjs';
import { DEFAULT_PAGE_SIZE, MOBILE_BREAKPOINT } from '../../../core/config';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { PartnersService } from '../../../core/services/partners.service';
import type { ListOffersParams, OfferResponse } from '../../../core/services/partners.types';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { DataRequest, DataResponse, GridColumn, GridConfig } from '../../../shared/components/data-grid/data-grid.types';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import type { PartnersOfferListResolved } from './partners-offer-list.resolver';

type OfferStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired';

type OfferApiRow = OfferResponse & {
  serviceType?: string;
  serviceTypeId?: string;
  leadCity?: string;
};

type OfferRow = OfferResponse & Record<string, unknown> & {
  vakmanPriceEuros: number;
  customerPriceEuros: number;
};

@Component({
  selector: 'app-partners-offer-list',
  templateUrl: './partners-offer-list.component.html',
  styleUrl: './partners-offer-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DataGridComponent, PageLayoutComponent, ConfirmDialogComponent, TranslatePipe],
})
export class PartnersOfferListComponent implements OnInit {
  private readonly partnersService = inject(PartnersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly offers = signal<OfferRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);

  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly pendingDeleteRows = signal<OfferRow[]>([]);
  protected readonly deleting = signal(false);
  protected readonly deleteCount = computed(() => this.pendingDeleteRows().length);

  protected readonly partnerOptions = signal<{ label: string; value: string }[]>([]);
  protected readonly serviceTypeOptions = signal<{ label: string; value: string }[]>([]);

  private readonly ignoreNextRequest = signal(true);

  protected readonly statusOptions = computed(() => {
    this.lang();
    return [
      { value: 'pending', label: this.translate.instant('partners.offer.status.pending') },
      { value: 'sent', label: this.translate.instant('partners.offer.status.sent') },
      { value: 'accepted', label: this.translate.instant('partners.offer.status.accepted') },
      { value: 'rejected', label: this.translate.instant('partners.offer.status.rejected') },
      { value: 'expired', label: this.translate.instant('partners.offer.status.expired') },
    ];
  });

  private readonly baseColumns = computed<GridColumn<OfferRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'partnerId',
        header: this.translate.instant('partners.offersList.columns.partner'),
        field: 'partnerId',
        sortable: true,
        filterable: true,
        width: '220px',
        cellType: 'select',
        selectOptions: this.partnerOptions(),
      },
      {
        id: 'serviceTypeId',
        header: this.translate.instant('partners.offersList.columns.serviceType'),
        field: 'serviceTypeId',
        sortable: true,
        filterable: true,
        width: '170px',
        cellType: 'select',
        selectOptions: this.serviceTypeOptions(),
      },
      {
        id: 'leadCity',
        header: this.translate.instant('partners.offersList.columns.city'),
        field: 'leadCity',
        sortable: false,
        filterable: false,
        width: '160px',
        cellType: 'text',
      },
      {
        id: 'status',
        header: this.translate.instant('partners.offersList.columns.status'),
        field: 'status',
        sortable: true,
        filterable: true,
        width: '150px',
        cellType: 'select',
        selectOptions: this.statusOptions(),
      },
      {
        id: 'vakmanPriceEuros',
        header: this.translate.instant('partners.offersList.columns.vakmanPrice'),
        field: 'vakmanPriceEuros',
        sortable: true,
        filterable: false,
        width: '140px',
        align: 'right',
        cellType: 'number',
      },
      {
        id: 'customerPriceEuros',
        header: this.translate.instant('partners.offersList.columns.customerPrice'),
        field: 'customerPriceEuros',
        sortable: true,
        filterable: false,
        width: '140px',
        align: 'right',
        cellType: 'number',
      },
      {
        id: 'expiresAt',
        header: this.translate.instant('partners.offersList.columns.expiresAt'),
        field: 'expiresAt',
        sortable: true,
        filterable: false,
        width: '140px',
        cellType: 'date',
      },
      {
        id: 'createdAt',
        header: this.translate.instant('partners.offersList.columns.createdAt'),
        field: 'createdAt',
        sortable: true,
        filterable: false,
        width: '140px',
        cellType: 'date',
      },
    ];
  });

  protected readonly columns = computed(() => this.baseColumns());

  protected readonly gridConfig = computed<Partial<GridConfig<OfferRow>>>(() => ({
    rowIdField: 'id',
	selectable: true,
    cardViewEnabled: true,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    cardTitleField: 'partnerName',
    cardSubtitleField: 'serviceType',
    statusField: 'status',
    cardPreviewFieldCount: 4,
    mobileAddRowEnabled: false,
    rowViewActionEnabled: true,
	rowDeleteActionEnabled: true,
	rowDeleteActionPredicate: (row) => this.canDeleteOffer(row),
  }));

  protected readonly fetchDataFn = this.fetchData.bind(this);

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['resolved'] as PartnersOfferListResolved | undefined;

    if (resolved) {
      this.partnerOptions.set(
        (resolved.partners ?? []).map(p => ({
          label: p.businessName,
          value: p.id,
        })),
      );
      this.serviceTypeOptions.set(
        (resolved.serviceTypes ?? []).map(st => ({
          label: st.name,
          value: st.id,
        })),
      );

      this.offers.set((resolved.offers.items ?? []).map(row => this.normalizeOffer(row)));
      this.total.set(resolved.offers.total ?? 0);
      this.loading.set(false);
      this.ignoreNextRequest.set(true);
    } else {
      this.ignoreNextRequest.set(false);
      this.loadInitialData();
    }
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.partnersService
      .listOffers({ page: 1, pageSize: DEFAULT_PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'desc' })
      .subscribe({
        next: (response) => {
          this.offers.set((response.items ?? []).map(row => this.normalizeOffer(row)));
          this.total.set(response.total);
          this.loading.set(false);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('partners.offersList.errors.loadOffers'), {
            allowErrorMessage: true,
            allowMessageField: true,
          });
          this.error.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.loading.set(false);
        },
      });
  }

  private normalizeOffer(row: OfferApiRow): OfferRow {
    return {
      ...row,
      leadCity: row.leadCity ?? '',
      serviceType: row.serviceType ?? '',
      serviceTypeId: row.serviceTypeId ?? '',
      vakmanPriceEuros: (row.vakmanPriceCents ?? 0) / 100,
      customerPriceEuros: (row.customerPriceCents ?? 0) / 100,
    };
  }

  protected fetchData(request: DataRequest): Observable<DataResponse<OfferRow>> {
    const sortFieldMap: Record<string, NonNullable<ListOffersParams['sortBy']>> = {
      partnerId: 'partnerName',
      serviceTypeId: 'serviceType',
      status: 'status',
      vakmanPriceEuros: 'vakmanPriceCents',
      customerPriceEuros: 'customerPriceCents',
      expiresAt: 'expiresAt',
      createdAt: 'createdAt',
    };

    const params: ListOffersParams = {
      page: request.page,
      pageSize: request.pageSize,
      sortBy: sortFieldMap[request.sort?.columnId ?? 'createdAt'] ?? 'createdAt',
      sortOrder: request.sort?.direction ?? 'desc',
    };

    if (request.searchTerm) {
      params.search = request.searchTerm;
    }

    for (const filter of request.filters) {
      switch (filter.columnId) {
        case 'status':
          if (filter.value) {
            params.status = filter.value as OfferStatus;
          }
          break;
        case 'partnerId':
          if (filter.value) {
            params.partnerId = filter.value;
          }
          break;
        case 'serviceTypeId':
          if (filter.value) {
            params.serviceTypeId = filter.value;
          }
          break;
        default:
          break;
      }
    }

    return this.partnersService.listOffers(params).pipe(
      map(response => ({
        data: (response.items ?? []).map(row => this.normalizeOffer(row)),
        totalItems: response.total,
        page: response.page,
        pageSize: response.pageSize,
      })),
    );
  }

  protected onDataRequest(request: DataRequest): void {
    if (this.ignoreNextRequest()) {
      this.ignoreNextRequest.set(false);
      return;
    }

    this.loading.set(true);
    this.fetchData(request).subscribe({
      next: (response) => {
        this.offers.set(response.data);
        this.total.set(response.totalItems);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.offersList.errors.loadOffers'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected onDeleteRows(rows: OfferRow[]): void {
    const deletable = rows.filter(r => this.canDeleteOffer(r));
    const blockedCount = Math.max(0, rows.length - deletable.length);

    if (deletable.length === 0) {
      this.toast.warning(this.translate.instant('partners.offersList.deleteNotAllowed'));
      return;
    }

    if (blockedCount > 0) {
      this.toast.info(this.translate.instant('partners.offersList.deleteSkipped', { count: blockedCount }));
    }

    this.pendingDeleteRows.set(deletable);
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleteDialogOpen.set(false);
    this.pendingDeleteRows.set([]);
  }

  protected confirmDelete(): void {
    const rows = this.pendingDeleteRows();
    if (rows.length === 0) {
      this.closeDeleteDialog();
      return;
    }

    this.deleting.set(true);
    const requests = rows.map(row => this.partnersService.deleteOffer(row.id));
    const requestMap = Object.fromEntries(requests.map((request, index) => [index, request]));

    forkJoin(requestMap).subscribe({
      next: () => {
        this.deleting.set(false);
        this.closeDeleteDialog();
        this.loadInitialData();
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.offersList.errors.deleteOffers'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleting.set(false);
      },
    });
  }

  private canDeleteOffer(row: OfferRow): boolean {
    const status = String(row.status ?? '').toLowerCase();
    return status === 'pending' || status === 'sent' || status === 'expired';
  }

  protected createOffer(): void {
	this.router.navigate(['/app/offers/new']);
  }

  protected onOfferDoubleClick(offer: OfferRow): void {
    if (!offer.id) return;
	this.router.navigate(['/app/offers', offer.id, 'preview']);
  }
}
