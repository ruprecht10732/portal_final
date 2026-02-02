import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  CatalogService,
  type CreateProductRequest,
  type PeriodUnit,
  type ProductType,
  type VatRate,
} from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';

@Component({
  selector: 'app-catalog-create',
  imports: [
    TranslateModule,
    ReactiveFormsModule,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    NumberInputComponent,
    SelectComponent,
    TextareaComponent,
  ],
  templateUrl: './catalog-create.component.html',
  styleUrl: './catalog-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogCreateComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitAttempted = signal(false);
  protected readonly vatRates = signal<VatRate[]>([]);

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

  protected readonly showPeriodFields = computed(() => {
    const type = this.form.controls.type.value;
    return type === 'service' || type === 'digital_service';
  });

  protected readonly requiredError = computed(() => this.translate.instant('catalog.products.validation.required'));

  ngOnInit(): void {
    this.loadVatRates();
  }

  private loadVatRates(): void {
    this.loading.set(true);
    this.catalogService.listVatRates({ pageSize: 100 }).subscribe({
      next: (response) => {
        this.vatRates.set(response.items);
        if (response.items.length > 0 && !this.form.controls.vatRateId.value) {
          this.form.controls.vatRateId.setValue(response.items[0].id);
        }
        this.loading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.loadVatRates'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected setType(value: ProductType | null): void {
    if (value) {
      this.form.controls.type.setValue(value);
    }
  }

  protected setVatRate(value: string | null): void {
    this.form.controls.vatRateId.setValue(value ?? '');
  }

  protected setPeriodUnit(value: PeriodUnit | null): void {
    this.form.controls.periodUnit.setValue(value);
  }

  protected save(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    const values = this.form.getRawValue();
    const priceCents = values.price === null ? 0 : CatalogService.priceToCents(values.price);

    const request: CreateProductRequest = {
      title: (values.title ?? '').trim(),
      reference: (values.reference ?? '').trim(),
      description: (values.description ?? '').trim() || undefined,
      priceCents,
      vatRateId: values.vatRateId!,
      type: values.type,
    };

    // Add period fields only for service types
    if (this.showPeriodFields()) {
      if (values.periodCount !== null) {
        request.periodCount = values.periodCount;
      }
      if (values.periodUnit !== null) {
        request.periodUnit = values.periodUnit;
      }
    }

    this.catalogService.createProduct(request).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('catalog.products.createSuccess'));
        this.router.navigate(['/app/catalog']);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('catalog.products.errors.createProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected cancel(): void {
    this.router.navigate(['/app/catalog']);
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
