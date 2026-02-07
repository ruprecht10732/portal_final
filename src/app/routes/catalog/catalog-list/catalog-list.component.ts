import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { CatalogService, type Product, type ProductType, type ListProductsParams, type VatRate, type UpdateProductRequest } from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ToastService } from '../../../core/services/toast.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { DataRequest, DataResponse, GridColumn, GridConfig } from '../../../shared/components/data-grid/data-grid.types';
import { DEFAULT_PAGE_SIZE, MOBILE_BREAKPOINT } from '../../../core/config';

/** Accepted price value types before normalization. */
type PriceInput = number | string | null | undefined;

type ProductRow = Product & {
  fixedPriceValue: number | null;
  unitPriceValue: number | null;
  thumbnailUrl?: string | null;
};

@Component({
  selector: 'app-catalog-list',
  imports: [TranslateModule, ButtonComponent, DataGridComponent, ConfirmDialogComponent, PageLayoutComponent],
  templateUrl: './catalog-list.component.html',
  styleUrl: './catalog-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly products = signal<ProductRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly vatRates = signal<VatRate[]>([]);
  private readonly vatRatesLoading = signal(false);
  private readonly lastRequest = signal<DataRequest | null>(null);
  private readonly thumbnailCache = new Map<string, string | null>();
  private readonly thumbnailLoading = new Set<string>();

  // Delete dialog
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly deleteInProgress = signal(false);
  protected readonly pendingDeleteProduct = signal<Product | null>(null);

  protected readonly typeOptions = computed(() => {
    this.lang();
    return [
      { label: this.translate.instant('catalog.products.types.service'), value: 'service' },
      { label: this.translate.instant('catalog.products.types.digital_service'), value: 'digital_service' },
      { label: this.translate.instant('catalog.products.types.product'), value: 'product' },
      { label: this.translate.instant('catalog.products.types.material'), value: 'material' },
    ] as const;
  });

  protected readonly vatRateOptions = computed(() => {
    this.lang();
    return this.vatRates().map(rate => ({
      label: `${rate.name} (${CatalogService.bpsToRate(rate.rateBps)}%)`,
      value: rate.id,
    }));
  });

  protected readonly columns = computed<GridColumn<ProductRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'thumbnail',
        header: this.translate.instant('catalog.products.columns.thumbnail'),
        field: 'thumbnailUrl',
        cellType: 'thumbnail',
        width: '64px',
        minWidth: '64px',
      },
      {
        id: 'reference',
        header: this.translate.instant('catalog.products.columns.reference'),
        field: 'reference',
        sortable: true,
        filterable: true,
        editable: true,
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('catalog.products.validation.referenceRequired')),
        width: '160px',
      },
      {
        id: 'title',
        header: this.translate.instant('catalog.products.columns.title'),
        field: 'title',
        sortable: true,
        filterable: true,
        editable: true,
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('catalog.products.validation.titleRequired')),
        minWidth: '220px',
      },
      {
        id: 'type',
        header: this.translate.instant('catalog.products.columns.type'),
        field: 'type',
        sortable: true,
        filterable: true,
        cellType: 'select',
        selectOptions: this.typeOptions(),
        editable: true,
        validator: value => this.typeOptions().some(option => option.value === value)
          ? null
          : this.translate.instant('catalog.products.validation.typeRequired'),
        width: '160px',
      },
      {
        id: 'vatRateId',
        header: this.translate.instant('catalog.products.columns.vatRate'),
        field: 'vatRateId',
        sortable: true,
        filterable: true,
        cellType: 'select',
        selectOptions: this.vatRateOptions(),
        editable: true,
        validator: value => this.vatRateOptions().some(option => option.value === value)
          ? null
          : this.translate.instant('catalog.products.validation.vatRateRequired'),
        minWidth: '220px',
      },
      {
        id: 'fixedPriceValue',
        header: this.translate.instant('catalog.products.columns.fixedPrice'),
        field: 'fixedPriceValue',
        cellType: 'number',
        editable: true,
        validator: (value, row) => this.validateFixedPrice(value, row),
        align: 'right',
        width: '160px',
      },
      {
        id: 'unitPriceValue',
        header: this.translate.instant('catalog.products.columns.unitPrice'),
        field: 'unitPriceValue',
        cellType: 'number',
        editable: true,
        validator: (value, row) => this.validateUnitPrice(value, row),
        align: 'right',
        width: '170px',
      },
      {
        id: 'unitLabel',
        header: this.translate.instant('catalog.products.columns.unitLabel'),
        field: 'unitLabel',
        editable: true,
        validator: (value, row) => this.validateUnitLabel(value, row),
        width: '130px',
      },
      {
        id: 'createdAt',
        header: this.translate.instant('catalog.products.fields.createdAt'),
        field: 'createdAt',
        sortable: true,
        filterable: true,
        cellType: 'date',
        width: '140px',
      },
      {
        id: 'updatedAt',
        header: this.translate.instant('catalog.products.fields.updatedAt'),
        field: 'updatedAt',
        sortable: true,
        filterable: true,
        cellType: 'date',
        width: '140px',
      },
    ];
  });

  protected readonly gridConfig: Partial<GridConfig<ProductRow>> = {
    rowIdField: 'id',
    selectable: false,
    cardViewEnabled: true,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    cardTitleField: 'title',
    cardSubtitleField: 'reference',
    cardPreviewFieldCount: 3,
    mobileAddRowEnabled: false,
    rowViewActionEnabled: true,
    rowDeleteActionEnabled: true,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);
  protected readonly gridColumns = computed<GridColumn<Record<string, unknown>>[]>(() =>
    this.columns() as unknown as GridColumn<Record<string, unknown>>[]
  );
  protected readonly gridData = computed<Record<string, unknown>[]>(() =>
    this.products() as unknown as Record<string, unknown>[]
  );
  protected readonly gridConfigAdapter = this.gridConfig as unknown as Partial<GridConfig<Record<string, unknown>>>;
  protected readonly gridFetchDataFn = this.fetchDataFn as unknown as (request: DataRequest) => Observable<DataResponse<Record<string, unknown>>>;

  protected createProduct(): void {
    this.router.navigate(['/app/catalog/new']);
  }

  protected viewProduct(product: Product): void {
    this.router.navigate(['/app/catalog', product.id]);
  }

  protected onRowDoubleClick(product: ProductRow): void {
    this.viewProduct(product);
  }

  protected onGridRowDoubleClick(row: Record<string, unknown>): void {
    this.onRowDoubleClick(row as unknown as ProductRow);
  }

  protected onDeleteRows(rows: ProductRow[]): void {
    const [product] = rows;
    if (!product) return;
    this.confirmDelete(product);
  }

  protected onGridDeleteRows(rows: Record<string, unknown>[]): void {
    this.onDeleteRows(rows as unknown as ProductRow[]);
  }

  protected onSaveRows(rows: ProductRow[]): void {
    const updates = rows
      .filter(row => !!row.id)
      .map(row => {
        const fixedPrice = this.normalizePriceValue(row.fixedPriceValue);
        const unitPrice = this.normalizePriceValue(row.unitPriceValue);
        const hasUnitPrice = unitPrice !== null;
        const hasFixedPrice = fixedPrice !== null;
        const updateRequest: UpdateProductRequest = {
          title: row.title?.trim(),
          reference: row.reference?.trim(),
          type: row.type,
          vatRateId: row.vatRateId,
        };

        if (hasUnitPrice) {
          updateRequest.unitPriceCents = CatalogService.priceToCents(unitPrice);
          updateRequest.unitLabel = row.unitLabel?.trim() ?? '';
          updateRequest.priceCents = 0;
        } else if (hasFixedPrice) {
          updateRequest.priceCents = CatalogService.priceToCents(fixedPrice);
          updateRequest.unitPriceCents = 0;
          updateRequest.unitLabel = '';
        }

        return this.catalogService.updateProduct(row.id, updateRequest).pipe(
          map(() => ({ ok: true })),
          catchError((err) => {
            const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.updateProduct'));
            this.error.set(message);
            this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
            return of({ ok: false });
          })
        );
      });

    if (updates.length === 0) return;

    forkJoin(updates).subscribe((results) => {
      const failed = results.some(result => !result.ok);
      if (failed) {
        this.toast.error(this.translate.instant('catalog.products.errors.updateProduct'));
      } else {
        this.toast.success(this.translate.instant('catalog.products.updateSuccess'));
      }
      this.refreshFromLastRequest();
    });
  }

  protected onGridSaveRows(rows: Record<string, unknown>[]): void {
    this.onSaveRows(rows as unknown as ProductRow[]);
  }

  protected confirmDelete(product: Product): void {
    this.pendingDeleteProduct.set(product);
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleteDialogOpen.set(false);
    this.pendingDeleteProduct.set(null);
    this.deleteInProgress.set(false);
  }

  protected deleteProduct(): void {
    const product = this.pendingDeleteProduct();
    if (!product) return;

    this.deleteInProgress.set(true);
    this.catalogService.deleteProduct(product.id).subscribe({
      next: () => {
        this.closeDeleteDialog();
        this.refreshFromLastRequest();
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.deleteProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleteInProgress.set(false);
      },
    });
  }

  protected onDataRequest(request: DataRequest): void {
    this.ensureVatRatesLoaded();
    this.lastRequest.set(request);
    this.loading.set(true);
    this.error.set(null);

    this.fetchData(request).subscribe({
      next: (response) => {
        this.products.set(response.data);
        this.ensureThumbnailsLoaded(response.data);
        this.total.set(response.totalItems);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadProducts'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected fetchData(request: DataRequest): Observable<DataResponse<ProductRow>> {
    const params: ListProductsParams = {
      page: request.page,
      pageSize: request.pageSize || DEFAULT_PAGE_SIZE,
      sortBy: this.mapSortField(request.sort?.columnId),
      sortOrder: request.sort?.direction ?? 'desc',
    };

    if (request.searchTerm.trim()) {
      params.search = request.searchTerm.trim();
    }

    for (const filter of request.filters) {
      if (filter.columnId === 'type') {
        params.type = filter.value as ProductType;
      }
      if (filter.columnId === 'vatRateId') {
        params.vatRateId = filter.value;
      }
    }

    return this.catalogService.listProducts(params).pipe(
      map(response => ({
        data: response.items.map(item => this.buildProductRow(item)),
        totalItems: response.total,
        page: response.page,
        pageSize: response.pageSize,
      }))
    );
  }

  private refreshFromLastRequest(): void {
    const request = this.lastRequest();
    if (request) {
      this.onDataRequest(request);
    }
  }

  private ensureVatRatesLoaded(): void {
    if (this.vatRates().length > 0 || this.vatRatesLoading()) return;
    this.vatRatesLoading.set(true);
    this.catalogService.listVatRates({ pageSize: 100 }).subscribe({
      next: (response) => {
        this.vatRates.set(response.items);
        this.vatRatesLoading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadVatRates'));
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.vatRatesLoading.set(false);
      },
    });
  }

  private buildProductRow(product: Product): ProductRow {
    const hasUnitPrice = product.unitPriceCents > 0;
    const fixedPriceValue = hasUnitPrice ? null : CatalogService.centsToPrice(product.priceCents ?? 0);
    const unitPriceValue = hasUnitPrice ? CatalogService.centsToPrice(product.unitPriceCents) : null;
    return {
      ...product,
      fixedPriceValue,
      unitPriceValue,
      unitLabel: product.unitLabel ?? '',
      thumbnailUrl: this.thumbnailCache.get(product.id) ?? null,
    };
  }

  private ensureThumbnailsLoaded(rows: ProductRow[]): void {
    rows.forEach((row) => {
      if (this.thumbnailCache.has(row.id) || this.thumbnailLoading.has(row.id)) return;
      this.thumbnailLoading.add(row.id);

      this.catalogService.listProductAssets(row.id, 'image').subscribe({
        next: (response) => {
          const first = response.items[0];
          if (!first) {
            this.setThumbnail(row.id, null);
            this.thumbnailLoading.delete(row.id);
            return;
          }
          if (first.url) {
            this.setThumbnail(row.id, first.url);
            this.thumbnailLoading.delete(row.id);
            return;
          }
          this.catalogService.getCatalogAssetDownloadUrl(row.id, first.id).subscribe({
            next: (download) => {
              this.setThumbnail(row.id, download.downloadUrl ?? null);
            },
            error: () => {
              this.setThumbnail(row.id, null);
            },
            complete: () => {
              this.thumbnailLoading.delete(row.id);
            },
          });
        },
        error: () => {
          this.setThumbnail(row.id, null);
          this.thumbnailLoading.delete(row.id);
        },
      });
    });
  }

  private setThumbnail(productId: string, url: string | null): void {
    this.thumbnailCache.set(productId, url);
    this.products.update(rows => rows.map(row => (
      row.id === productId ? { ...row, thumbnailUrl: url } : row
    )));
  }
  private mapSortField(columnId?: string | null): string {
    switch (columnId) {
      case 'reference':
        return 'reference';
      case 'title':
        return 'title';
      case 'type':
        return 'type';
      case 'vatRateId':
        return 'vatRateId';
      case 'fixedPriceValue':
        return 'priceCents';
      case 'unitPriceValue':
        return 'unitPriceCents';
      case 'unitLabel':
        return 'unitLabel';
      case 'createdAt':
        return 'createdAt';
      case 'updatedAt':
        return 'updatedAt';
      default:
        return 'createdAt';
    }
  }

  private normalizePriceValue(value: PriceInput): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private validateFixedPrice(value: unknown, row: ProductRow): string | null {
    const fixedPrice = this.normalizePriceValue(value as PriceInput);
    const unitPrice = this.normalizePriceValue(row.unitPriceValue);

    if (fixedPrice === null) {
      return unitPrice === null
        ? this.translate.instant('catalog.products.validation.fixedPriceRequired')
        : null;
    }

    if (fixedPrice < 0) {
      return this.translate.instant('catalog.products.validation.priceMin');
    }

    return null;
  }

  private validateUnitPrice(value: unknown, row: ProductRow): string | null {
    const unitPrice = this.normalizePriceValue(value as PriceInput);
    const fixedPrice = this.normalizePriceValue(row.fixedPriceValue);

    if (unitPrice === null) {
      return fixedPrice === null
        ? this.translate.instant('catalog.products.validation.unitPriceRequired')
        : null;
    }

    if (unitPrice < 0) {
      return this.translate.instant('catalog.products.validation.priceMin');
    }

    return null;
  }

  private validateUnitLabel(value: unknown, row: ProductRow): string | null {
    const unitPrice = this.normalizePriceValue(row.unitPriceValue);
    if (unitPrice === null) return null;
    const label = typeof value === 'string' ? value.trim() : '';
    return label.length > 0
      ? null
      : this.translate.instant('catalog.products.validation.unitLabelRequired');
  }
}
