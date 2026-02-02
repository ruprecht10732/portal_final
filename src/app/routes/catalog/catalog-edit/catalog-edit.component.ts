import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  CatalogService,
  type PeriodUnit,
  type Product,
  type ProductType,
  type UpdateProductRequest,
  type VatRate,
} from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-catalog-edit',
  imports: [
    TranslateModule,
    ReactiveFormsModule,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    NumberInputComponent,
    SelectComponent,
    TextareaComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './catalog-edit.component.html',
  styleUrl: './catalog-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogEditComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitAttempted = signal(false);
  protected readonly vatRates = signal<VatRate[]>([]);
  protected readonly activeTab = signal<'details' | 'materials'>('details');
  protected readonly selectedType = signal<ProductType>('product');

  // Materials management
  protected readonly materials = signal<Product[]>([]);
  protected readonly materialsLoading = signal(false);
  protected readonly availableMaterials = signal<Product[]>([]);
  protected readonly showAddMaterialDialog = signal(false);
  protected readonly selectedMaterialIds = signal<string[]>([]);
  protected readonly addingMaterials = signal(false);
  protected readonly removingMaterialId = signal<string | null>(null);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    reference: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(1000)],
    price: this.fb.control<number | null>(null, Validators.required),
    vatRateId: ['', Validators.required],
    type: this.fb.control<ProductType>('product', { nonNullable: true }),
    periodCount: this.fb.control<number | null>(null),
    periodUnit: this.fb.control<PeriodUnit | null>(null),
  });

  protected readonly typeOptions = computed<SelectOption<ProductType>[]>(() => [
    { label: this.translate.instant('catalog.products.types.digital_service'), value: 'digital_service' },
    { label: this.translate.instant('catalog.products.types.service'), value: 'service' },
    { label: this.translate.instant('catalog.products.types.product'), value: 'product' },
    { label: this.translate.instant('catalog.products.types.material'), value: 'material' },
  ]);

  protected readonly periodUnitOptions = computed<SelectOption<PeriodUnit>[]>(() => [
    { label: this.translate.instant('catalog.products.periodUnits.day'), value: 'day' },
    { label: this.translate.instant('catalog.products.periodUnits.week'), value: 'week' },
    { label: this.translate.instant('catalog.products.periodUnits.month'), value: 'month' },
    { label: this.translate.instant('catalog.products.periodUnits.quarter'), value: 'quarter' },
    { label: this.translate.instant('catalog.products.periodUnits.year'), value: 'year' },
  ]);

  protected readonly vatRateOptions = computed<SelectOption<string>[]>(() =>
    this.vatRates().map(vr => ({
      label: `${vr.name} (${CatalogService.bpsToRate(vr.rateBps)}%)`,
      value: vr.id,
    }))
  );

  /** True for service types that support billing periods */
  protected readonly isServiceType = computed(() => {
    const type = this.selectedType();
    return type === 'service' || type === 'digital_service';
  });

  /** Show materials tab based on current selected type (reactive to type changes) */
  protected readonly showMaterialsTab = computed(() => this.isServiceType());

  protected readonly requiredError = computed(() => this.translate.instant('catalog.products.validation.required'));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'materials') {
      this.activeTab.set('materials');
    }
    if (id) {
      this.loadVatRates();
      this.loadProduct(id);
    }
  }

  private loadProduct(id: string): void {
    this.loading.set(true);
    this.catalogService.getProduct(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.populateForm(product);
        this.loading.set(false);
        if (product.type === 'service' || product.type === 'digital_service') {
          this.loadMaterials(id);
        }
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.loadProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private populateForm(product: Product): void {
    this.selectedType.set(product.type);
    this.form.patchValue({
      title: product.title,
      reference: product.reference,
      description: product.description ?? '',
      price: CatalogService.centsToPrice(product.priceCents),
      vatRateId: product.vatRateId,
      type: product.type,
      periodCount: product.periodCount ?? null,
      periodUnit: product.periodUnit ?? null,
    });
  }

  private loadVatRates(): void {
    this.catalogService.listVatRates({ pageSize: 100 }).subscribe({
      next: (response) => {
        this.vatRates.set(response.items);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.loadVatRates'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadMaterials(productId: string): void {
    this.materialsLoading.set(true);
    this.catalogService.listProductMaterials(productId).subscribe({
      next: (materials) => {
        this.materials.set(materials);
        this.materialsLoading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.loadMaterials'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.materialsLoading.set(false);
      },
    });
  }

  protected setType(value: ProductType | null): void {
    if (value) {
      const wasServiceType = this.isServiceType();
      this.form.controls.type.setValue(value);
      this.selectedType.set(value);
      
      // Clear period fields and switch to details tab when switching from service to non-service type
      const isNowServiceType = value === 'service' || value === 'digital_service';
      if (wasServiceType && !isNowServiceType) {
        this.form.controls.periodCount.setValue(null);
        this.form.controls.periodUnit.setValue(null);
        this.activeTab.set('details');
      }
      
      // Load materials if switching to service type
      const product = this.product();
      if (!wasServiceType && isNowServiceType && product) {
        this.loadMaterials(product.id);
      }
    }
  }

  protected setVatRate(value: string | null): void {
    this.form.controls.vatRateId.setValue(value ?? '');
  }

  protected setPeriodUnit(value: PeriodUnit | null): void {
    this.form.controls.periodUnit.setValue(value);
  }

  protected setActiveTab(tab: 'details' | 'materials'): void {
    this.activeTab.set(tab);
  }

  protected save(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();

    const product = this.product();
    if (!product || this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    const values = this.form.getRawValue();
    const priceCents = values.price === null ? 0 : CatalogService.priceToCents(values.price);

    const request: UpdateProductRequest = {
      title: (values.title ?? '').trim(),
      reference: (values.reference ?? '').trim(),
      description: (values.description ?? '').trim() || undefined,
      priceCents,
      vatRateId: values.vatRateId ?? undefined,
      type: values.type,
    };

    // Add period fields only for service types
    if (this.isServiceType()) {
      request.periodCount = values.periodCount ?? undefined;
      request.periodUnit = values.periodUnit ?? undefined;
    }

    this.catalogService.updateProduct(product.id, request).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('catalog.products.updateSuccess'));
        this.router.navigate(['/app/catalog', product.id]);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.updateProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected cancel(): void {
    const product = this.product();
    if (product) {
      this.router.navigate(['/app/catalog', product.id]);
    } else {
      this.router.navigate(['/app/catalog']);
    }
  }

  // Materials management methods
  protected openAddMaterialDialog(): void {
    this.selectedMaterialIds.set([]);
    this.loadAvailableMaterials();
    this.showAddMaterialDialog.set(true);
  }

  protected closeAddMaterialDialog(): void {
    this.showAddMaterialDialog.set(false);
    this.selectedMaterialIds.set([]);
  }

  private loadAvailableMaterials(): void {
    this.catalogService.listProducts({ type: 'material', pageSize: 100 }).subscribe({
      next: (response) => {
        // Filter out already linked materials
        const linkedIds = new Set(this.materials().map(m => m.id));
        this.availableMaterials.set(response.items.filter(m => !linkedIds.has(m.id)));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.loadMaterials'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected toggleMaterialSelection(materialId: string): void {
    this.selectedMaterialIds.update(ids => {
      if (ids.includes(materialId)) {
        return ids.filter(id => id !== materialId);
      }
      return [...ids, materialId];
    });
  }

  protected isMaterialSelected(materialId: string): boolean {
    return this.selectedMaterialIds().includes(materialId);
  }

  protected addSelectedMaterials(): void {
    const product = this.product();
    const ids = this.selectedMaterialIds();
    if (!product || ids.length === 0) return;

    this.addingMaterials.set(true);
    this.catalogService.addProductMaterials(product.id, { materialIds: ids }).subscribe({
      next: () => {
        this.closeAddMaterialDialog();
        this.loadMaterials(product.id);
        this.addingMaterials.set(false);
        this.toast.success(this.translate.instant('catalog.products.materialsAdded'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.addMaterials'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.addingMaterials.set(false);
      },
    });
  }

  protected removeMaterial(materialId: string): void {
    const product = this.product();
    if (!product) return;

    this.removingMaterialId.set(materialId);
    this.catalogService.removeProductMaterials(product.id, { materialIds: [materialId] }).subscribe({
      next: () => {
        this.materials.update(list => list.filter(m => m.id !== materialId));
        this.removingMaterialId.set(null);
        this.toast.success(this.translate.instant('catalog.products.materialRemoved'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.removeMaterial'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.removingMaterialId.set(null);
      },
    });
  }

  protected formatPrice(priceCents: number): string {
    return `€${CatalogService.centsToPrice(priceCents).toFixed(2)}`;
  }

  protected requiredControlError(control: { hasError: (error: string) => boolean } | null): string {
    if (!this.submitAttempted()) return '';
    if (!control?.hasError('required')) return '';
    return this.requiredError();
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
