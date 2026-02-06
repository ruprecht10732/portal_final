import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, Observable } from 'rxjs';
import { CatalogService, type Product, type ProductType, type ListProductsParams } from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { DataRequest, DataResponse, GridColumn, GridConfig } from '../../../shared/components/data-grid/data-grid.types';
import { DEFAULT_PAGE_SIZE, MOBILE_BREAKPOINT } from '../../../core/config';

type ProductRow = Product & {
  priceLabel: string;
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
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly products = signal<ProductRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);
  private readonly lastRequest = signal<DataRequest | null>(null);

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

  protected readonly columns = computed<GridColumn<ProductRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'reference',
        header: this.translate.instant('catalog.products.columns.reference'),
        field: 'reference',
        sortable: true,
        width: '160px',
      },
      {
        id: 'title',
        header: this.translate.instant('catalog.products.columns.title'),
        field: 'title',
        sortable: true,
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
        width: '160px',
      },
      {
        id: 'priceLabel',
        header: this.translate.instant('catalog.products.columns.price'),
        field: 'priceLabel',
        align: 'right',
        width: '160px',
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
    this.lastRequest.set(request);
    this.loading.set(true);
    this.error.set(null);

    this.fetchData(request).subscribe({
      next: (response) => {
        this.products.set(response.data);
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

  private buildProductRow(product: Product): ProductRow {
    return {
      ...product,
      priceLabel: this.formatPrice(product),
    };
  }

  private mapSortField(columnId?: string | null): string {
    switch (columnId) {
      case 'reference':
        return 'reference';
      case 'title':
        return 'title';
      case 'type':
        return 'type';
      default:
        return 'createdAt';
    }
  }

  protected formatPrice(product: Product): string {
    if (product.priceCents > 0) {
      return `€${CatalogService.centsToPrice(product.priceCents).toFixed(2)}`;
    }
    if (product.unitPriceCents > 0 && product.unitLabel) {
      return `€${CatalogService.centsToPrice(product.unitPriceCents).toFixed(2)} / ${product.unitLabel}`;
    }
    if (product.unitPriceCents > 0) {
      return `€${CatalogService.centsToPrice(product.unitPriceCents).toFixed(2)}`;
    }
    return '—';
  }
}
