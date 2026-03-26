import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CatalogService,
  type CreateProductRequest,
  type MaterialPricingMode,
  type ProductType,
  type VatRate,
} from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CatalogFormComponent, type CatalogFormValue } from '../catalog-form/catalog-form.component';

interface InlineMaterialDraft {
  id: number;
  title: string;
  reference: string;
  priceType: 'fixed' | 'unit';
  price: number | null;
  unitPrice: number | null;
  unitLabel: string;
  vatRateId: string;
  pricingMode: MaterialPricingMode;
}

@Component({
  selector: 'app-catalog-create',
  imports: [
    TranslateModule,
    PageHeaderComponent,
    CatalogFormComponent,
  ],
  templateUrl: './catalog-create.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class CatalogCreateComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly vatRates = signal<VatRate[]>([]);
  protected readonly suggestedReference = signal<string | null>(null);
  protected readonly selectedType = signal<ProductType>('product');
  protected readonly materialRows = signal<InlineMaterialDraft[]>([]);
  protected readonly CatalogService = CatalogService;
  private nextMaterialRowId = 1;

  ngOnInit(): void {
    this.loadVatRates();
    this.loadSuggestedReference();
  }

  private loadSuggestedReference(): void {
    this.catalogService.getNextProductReference().subscribe({
      next: (response) => {
        this.suggestedReference.set(response.reference);
      },
      error: () => {
        this.suggestedReference.set(null);
      },
    });
  }

  private loadVatRates(): void {
    this.loading.set(true);
    this.catalogService.listVatRates({ pageSize: 100 }).subscribe({
      next: (response) => {
        this.vatRates.set(response.items);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadVatRates'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected save(values: CatalogFormValue): void {
    if (this.saving()) return;

    const materialValidationError = this.validateInlineMaterials(values.type);
    if (materialValidationError) {
      this.error.set(materialValidationError);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const request = this.buildCreateRequest(values);

    this.catalogService.createProduct(request).subscribe({
      next: (product) => {
        const rows = this.materialRows();
        const isServiceType = product.type === 'service' || product.type === 'digital_service';

        if (!isServiceType || rows.length === 0) {
          this.toast.success(this.translate.instant('catalog.products.createSuccess'));
          this.router.navigate(['/app/settings/catalog', product.id]);
          return;
        }

        const materialPayloads: CreateProductRequest[] = rows.map(row => {
          const rowIsFixed = row.priceType === 'fixed';
          const rowUnitLabel = row.unitLabel.trim();
          return {
            title: row.title.trim(),
            vatRateId: row.vatRateId,
            type: 'material',
            priceCents: rowIsFixed && row.price !== null ? CatalogService.priceToCents(row.price) : 0,
            unitPriceCents: !rowIsFixed && row.unitPrice !== null ? CatalogService.priceToCents(row.unitPrice) : 0,
            ...(row.reference.trim() && { reference: row.reference.trim() }),
            ...(!rowIsFixed && rowUnitLabel && { unitLabel: rowUnitLabel }),
          };
        });

        this.createAndAttachMaterials(product.id, materialPayloads, rows.map(row => row.pricingMode));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.createProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  private buildCreateRequest(values: CatalogFormValue): CreateProductRequest {
    const isFixed = values.priceType === 'fixed';
    const priceCents = isFixed && values.price !== null ? CatalogService.priceToCents(values.price) : 0;
    const unitPriceCents = !isFixed && values.unitPrice !== null ? CatalogService.priceToCents(values.unitPrice) : 0;
    const unitLabelValue = (values.unitLabel ?? '').trim();
    const descriptionValue = (values.description ?? '').trim();
    const laborTimeTextValue = (values.laborTimeText ?? '').trim();

    const request: CreateProductRequest = {
      title: values.title,
      priceCents,
      unitPriceCents,
      vatRateId: values.vatRateId,
      type: values.type,
      isDraft: values.isDraft,
      ...(values.reference && { reference: values.reference }),
      ...(descriptionValue && { description: descriptionValue }),
      ...(!isFixed && unitLabelValue && { unitLabel: unitLabelValue }),
    };

    if (values.type !== 'service' && values.type !== 'digital_service') {
      return request;
    }

    if (values.periodCount !== null) request.periodCount = values.periodCount;
    if (values.periodUnit !== null) request.periodUnit = values.periodUnit;
    if (laborTimeTextValue) request.laborTimeText = laborTimeTextValue;

    return request;
  }

  protected cancel(): void {
    this.router.navigate(['/app/settings/catalog']);
  }

  protected handleTypeChange(value: ProductType): void {
    this.selectedType.set(value);
    if (value !== 'service' && value !== 'digital_service') {
      this.materialRows.set([]);
    }
  }

  protected isServiceType(): boolean {
    const type = this.selectedType();
    return type === 'service' || type === 'digital_service';
  }

  protected addMaterialRow(): void {
    const [firstVatRate] = this.vatRates();
    const rowId = this.nextMaterialRowId++;
    this.materialRows.update(rows => ([
      ...rows,
      {
        id: rowId,
        title: '',
        reference: '',
        priceType: 'fixed',
        price: null,
        unitPrice: null,
        unitLabel: '',
        vatRateId: firstVatRate?.id ?? '',
        pricingMode: 'additional',
      },
    ]));

    this.prefillMaterialReference(rowId);
  }

  private prefillMaterialReference(rowId: number): void {
    this.catalogService.getNextProductReference().subscribe({
      next: (response) => {
        this.materialRows.update(rows => rows.map(row => {
          if (row.id !== rowId) return row;
          if (row.reference.trim()) return row;
          return { ...row, reference: response.reference };
        }));
      },
      error: () => {
        // Keep empty reference on prefill failures; field remains editable.
      },
    });
  }

  protected removeMaterialRow(id: number): void {
    this.materialRows.update(rows => rows.filter(row => row.id !== id));
  }

  protected updateMaterialField<K extends keyof InlineMaterialDraft>(id: number, field: K, value: InlineMaterialDraft[K]): void {
    this.materialRows.update(rows => rows.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: value };
      if (field === 'priceType') {
        if (value === 'fixed') {
          updated.unitPrice = null;
          updated.unitLabel = '';
        } else {
          updated.price = null;
        }
      }
      return updated;
    }));
  }

  protected mapNumberInput(value: number): number | null {
    return Number.isNaN(value) ? null : value;
  }

  private validateInlineMaterials(type: ProductType): string | null {
    if (type !== 'service' && type !== 'digital_service') {
      return null;
    }

    for (const row of this.materialRows()) {
      const rowValidationError = this.validateMaterialRow(row);
      if (rowValidationError) {
        return rowValidationError;
      }
    }

    return null;
  }

  private validateMaterialRow(row: InlineMaterialDraft): string | null {
    if (!row.title.trim()) {
      return this.translate.instant('catalog.products.inlineMaterials.validation.titleRequired');
    }
    if (!row.vatRateId) {
      return this.translate.instant('catalog.products.inlineMaterials.validation.vatRateRequired');
    }
    if (row.priceType === 'fixed') {
      if (row.price === null || row.price < 0) {
        return this.translate.instant('catalog.products.inlineMaterials.validation.fixedPriceRequired');
      }
      return null;
    }
    if (row.unitPrice === null || row.unitPrice < 0) {
      return this.translate.instant('catalog.products.inlineMaterials.validation.unitPriceRequired');
    }
    if (!row.unitLabel.trim()) {
      return this.translate.instant('catalog.products.inlineMaterials.validation.unitLabelRequired');
    }
    return null;
  }

  private createAndAttachMaterials(serviceId: string, materialPayloads: CreateProductRequest[], pricingModes: MaterialPricingMode[]): void {
    const createdMaterials: { id: string; pricingMode: MaterialPricingMode }[] = [];

    const createNext = (index: number): void => {
      if (index >= materialPayloads.length) {
        this.catalogService.addProductMaterials(serviceId, {
          materials: createdMaterials.map(item => ({ materialId: item.id, pricingMode: item.pricingMode })),
        }).subscribe({
          next: () => {
            this.toast.success(this.translate.instant('catalog.products.createSuccess'));
            this.router.navigate(['/app/settings/catalog', serviceId]);
          },
          error: (err) => {
            const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.addMaterials'));
            this.error.set(message);
            this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
            this.saving.set(false);
          },
        });
        return;
      }

      this.catalogService.createProduct(materialPayloads[index]!).subscribe({
        next: (created) => {
          createdMaterials.push({ id: created.id, pricingMode: pricingModes[index] ?? 'additional' });
          createNext(index + 1);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.createProduct'));
          this.error.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.saving.set(false);
        },
      });
    };

    createNext(0);
  }

}
