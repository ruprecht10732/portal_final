import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CatalogService, type Product, type ProductType, type ListProductsParams, type PaginatedResponse } from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { ChipComponent, type ChipVariant } from '../../../shared/components/chip/chip.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DEFAULT_PAGE_SIZE } from '../../../core/config';

@Component({
  selector: 'app-catalog-list',
  imports: [TranslateModule, FormsModule, ButtonComponent, InputComponent, SelectComponent, ChipComponent, ConfirmDialogComponent],
  templateUrl: './catalog-list.component.html',
  styleUrl: './catalog-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly totalPages = signal(0);

  // Filters
  protected readonly searchTerm = signal('');
  protected readonly typeFilter = signal<ProductType | ''>('');

  // Delete dialog
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly deleteInProgress = signal(false);
  protected readonly pendingDeleteProduct = signal<Product | null>(null);

  protected readonly typeOptions = computed<SelectOption<ProductType | ''>[]>(() => [
    { label: this.translate.instant('catalog.products.types.all'), value: '' },
    { label: this.translate.instant('catalog.products.types.service'), value: 'service' },
    { label: this.translate.instant('catalog.products.types.digital_service'), value: 'digital_service' },
    { label: this.translate.instant('catalog.products.types.product'), value: 'product' },
    { label: this.translate.instant('catalog.products.types.material'), value: 'material' },
  ]);

  protected readonly hasProducts = computed(() => this.products().length > 0);
  protected readonly isEmpty = computed(() => !this.loading() && !this.hasProducts());

  ngOnInit(): void {
    this.loadProducts();
  }

  protected loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: ListProductsParams = {
      page: this.page(),
      pageSize: this.pageSize(),
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    if (this.searchTerm().trim()) {
      params.search = this.searchTerm().trim();
    }

    if (this.typeFilter()) {
      params.type = this.typeFilter() as ProductType;
    }

    this.catalogService.listProducts(params).subscribe({
      next: (response: PaginatedResponse<Product>) => {
        this.products.set(response.items);
        this.total.set(response.total);
        this.totalPages.set(response.totalPages);
        this.loading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.loadProducts'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected onSearch(): void {
    this.page.set(1);
    this.loadProducts();
  }

  protected onTypeFilterChange(type: ProductType | '' | null): void {
    this.typeFilter.set(type ?? '');
    this.page.set(1);
    this.loadProducts();
  }

  protected onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  protected createProduct(): void {
    this.router.navigate(['/app/catalog/new']);
  }

  protected viewProduct(product: Product): void {
    this.router.navigate(['/app/catalog', product.id]);
  }

  protected editProduct(product: Product): void {
    this.router.navigate(['/app/catalog', product.id, 'edit']);
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
        this.loadProducts();
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.deleteProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleteInProgress.set(false);
      },
    });
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.loadProducts();
    }
  }

  protected prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadProducts();
    }
  }

  protected formatPrice(priceCents: number): string {
    return `€${CatalogService.centsToPrice(priceCents).toFixed(2)}`;
  }

  protected getTypeVariant(type: ProductType): ChipVariant {
    switch (type) {
      case 'service':
        return 'info';
      case 'digital_service':
        return 'warning';
      case 'product':
        return 'success';
      case 'material':
        return 'neutral';
      default:
        return 'default';
    }
  }

  protected getTypeLabel(type: ProductType): string {
    return this.translate.instant(`catalog.products.types.${type}`);
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const nested = (error as { error?: { error?: string } | string }).error;
      if (typeof nested === 'string') return nested;
      if (nested && typeof nested === 'object' && 'error' in nested && typeof nested.error === 'string') {
        return nested.error;
      }
    }
    return fallback;
  }
}
