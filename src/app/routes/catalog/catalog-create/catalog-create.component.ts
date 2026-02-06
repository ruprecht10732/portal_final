import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CatalogService,
  type CreateProductRequest,
  type VatRate,
} from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CatalogFormComponent, type CatalogFormValue } from '../catalog-form/catalog-form.component';

@Component({
  selector: 'app-catalog-create',
  imports: [
    TranslateModule,
    PageHeaderComponent,
    CatalogFormComponent,
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

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly vatRates = signal<VatRate[]>([]);

  ngOnInit(): void {
    this.loadVatRates();
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
    this.saving.set(true);
    this.error.set(null);

    const isFixed = values.priceType === 'fixed';
    const priceCents = isFixed && values.price !== null ? CatalogService.priceToCents(values.price) : 0;
    const unitPriceCents = !isFixed && values.unitPrice !== null ? CatalogService.priceToCents(values.unitPrice) : 0;
    const unitLabelValue = (values.unitLabel ?? '').trim();
    const descriptionValue = (values.description ?? '').trim();
    const laborTimeTextValue = (values.laborTimeText ?? '').trim();

    const request: CreateProductRequest = {
      title: values.title,
      reference: values.reference,
      priceCents,
      unitPriceCents,
      vatRateId: values.vatRateId,
      type: values.type,
      ...(descriptionValue && { description: descriptionValue }),
      ...(!isFixed && unitLabelValue && { unitLabel: unitLabelValue }),
    };

    // Add period fields only for service types
    if (values.type === 'service' || values.type === 'digital_service') {
      if (values.periodCount !== null) request.periodCount = values.periodCount;
      if (values.periodUnit !== null) request.periodUnit = values.periodUnit;
      if (laborTimeTextValue) request.laborTimeText = laborTimeTextValue;
    }

    this.catalogService.createProduct(request).subscribe({
      next: (product) => {
        this.toast.success(this.translate.instant('catalog.products.createSuccess'));
        // If service type, redirect to edit page so user can add materials
        if (product.type === 'service' || product.type === 'digital_service') {
          this.router.navigate(['/app/catalog', product.id, 'edit'], { queryParams: { tab: 'materials' } });
        } else {
          this.router.navigate(['/app/catalog']);
        }
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.createProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected cancel(): void {
    this.router.navigate(['/app/catalog']);
  }

}
