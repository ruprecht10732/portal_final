import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CatalogService,
  type PeriodUnit,
  type ProductType,
  type VatRate,
} from '../../../core/services/catalog.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';

export interface CatalogFormValue {
  title: string;
  reference: string;
  description: string;
  price: number | null;
  vatRateId: string;
  type: ProductType;
  periodCount: number | null;
  periodUnit: PeriodUnit | null;
}

@Component({
  selector: 'catalog-form',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonComponent,
    InputComponent,
    NumberInputComponent,
    SelectComponent,
    TextareaComponent,
  ],
  templateUrl: './catalog-form.component.html',
  styleUrl: './catalog-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly initialValue = input<CatalogFormValue | null>(null);
  readonly vatRates = input<VatRate[]>([]);
  readonly saving = input(false);
  readonly submitLabel = input('');
  readonly cancelLabel = input('');
  readonly showMaterialsHint = input(false);

  readonly submitted = output<CatalogFormValue>();
  readonly cancelled = output<void>();
  readonly typeChanged = output<ProductType>();

  protected readonly submitAttempted = signal(false);
  protected readonly selectedType = signal<ProductType>('product');

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

  protected readonly isServiceType = computed(() => {
    const type = this.selectedType();
    return type === 'service' || type === 'digital_service';
  });

  protected readonly requiredError = computed(() => this.translate.instant('catalog.products.validation.required'));

  constructor() {
    effect(() => {
      const initial = this.initialValue();
      if (!initial) return;
      this.form.patchValue({
        title: initial.title,
        reference: initial.reference,
        description: initial.description ?? '',
        price: initial.price,
        vatRateId: initial.vatRateId,
        type: initial.type,
        periodCount: initial.periodCount ?? null,
        periodUnit: initial.periodUnit ?? null,
      });
      this.selectedType.set(initial.type);
    });

    effect(() => {
      const rates = this.vatRates();
      if (!rates.length) return;
      const [firstRate] = rates;
      if (!firstRate) return;
      if (!this.form.controls.vatRateId.value) {
        this.form.controls.vatRateId.setValue(firstRate.id);
      }
    });
  }

  protected setType(value: ProductType | null): void {
    if (!value) return;
    const wasServiceType = this.isServiceType();
    this.form.controls.type.setValue(value);
    this.selectedType.set(value);

    const isNowServiceType = value === 'service' || value === 'digital_service';
    if (wasServiceType && !isNowServiceType) {
      this.form.controls.periodCount.setValue(null);
      this.form.controls.periodUnit.setValue(null);
    }

    this.typeChanged.emit(value);
  }

  protected setVatRate(value: string | null): void {
    this.form.controls.vatRateId.setValue(value ?? '');
  }

  protected setPeriodUnit(value: PeriodUnit | null): void {
    this.form.controls.periodUnit.setValue(value);
  }

  protected submit(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) return;

    const values = this.form.getRawValue();
    this.submitted.emit({
      title: (values.title ?? '').trim(),
      reference: (values.reference ?? '').trim(),
      description: (values.description ?? '').trim(),
      price: values.price,
      vatRateId: values.vatRateId ?? '',
      type: values.type,
      periodCount: values.periodCount ?? null,
      periodUnit: values.periodUnit ?? null,
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected requiredControlError(control: { hasError: (error: string) => boolean } | null): string {
    if (!this.submitAttempted()) return '';
    if (!control?.hasError('required')) return '';
    return this.requiredError();
  }
}
