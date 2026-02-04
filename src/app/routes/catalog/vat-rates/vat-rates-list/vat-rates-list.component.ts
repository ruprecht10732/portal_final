import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService, VatRate } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../../shared/components/number-input/number-input.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataGridComponent } from '../../../../shared/components/data-grid/data-grid.component';
import type { GridColumn, GridConfig } from '../../../../shared/components/data-grid/data-grid.types';
import { MOBILE_BREAKPOINT } from '../../../../core/config';
import { toSignal } from '@angular/core/rxjs-interop';

type VatRateRow = VatRate & { rateDisplay: string } & Record<string, unknown>;

@Component({
  selector: 'app-vat-rates-list',
  templateUrl: './vat-rates-list.component.html',
  styleUrl: './vat-rates-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonComponent,
    InputComponent,
    NumberInputComponent,
    ConfirmDialogComponent,
    DataGridComponent,
  ],
})
export class VatRatesListComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  // State
  protected readonly vatRates = signal<VatRate[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  // Modal state
  protected readonly isModalOpen = signal(false);
  protected readonly editingRate = signal<VatRate | null>(null);
  protected readonly formName = signal('');
  protected readonly formRate = signal<number | null>(null);

  // Delete dialog state
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly pendingDeleteRate = signal<VatRate | null>(null);

  // Form validation
  protected readonly formNameError = computed(() => {
    const name = this.formName().trim();
    if (!name) return this.translate.instant('catalog.vatRates.validation.nameRequired');
    if (name.length > 100) return this.translate.instant('catalog.vatRates.validation.nameTooLong');
    return '';
  });

  protected readonly formRateError = computed(() => {
    const rate = this.formRate();
    if (rate === null || rate === undefined) return this.translate.instant('catalog.vatRates.validation.rateRequired');
    if (rate < 0 || rate > 100) return this.translate.instant('catalog.vatRates.validation.rateRange');
    return '';
  });

  protected readonly isFormValid = computed(() => !this.formNameError() && !this.formRateError());

  protected readonly isEditing = computed(() => !!this.editingRate());
  protected readonly modalTitle = computed(() =>
    this.isEditing()
      ? this.translate.instant('catalog.vatRates.editTitle')
      : this.translate.instant('catalog.vatRates.addTitle')
  );

  protected readonly vatRateRows = computed<VatRateRow[]>(() =>
    this.vatRates().map(rate => ({
      ...rate,
      rateDisplay: this.formatRate(rate.rateBps),
    }))
  );

  protected readonly columns = computed<GridColumn<VatRateRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'name',
        header: this.translate.instant('catalog.vatRates.columns.name'),
        field: 'name',
        sortable: false,
        filterable: false,
        width: '240px',
        cellType: 'text',
      },
      {
        id: 'rate',
        header: this.translate.instant('catalog.vatRates.columns.rate'),
        field: 'rateDisplay',
        sortable: false,
        filterable: false,
        width: '140px',
        align: 'right',
        cellType: 'text',
      },
    ];
  });

  protected readonly gridConfig: Partial<GridConfig<VatRateRow>> = {
    rowIdField: 'id',
    selectable: false,
    multiSelect: false,
    cardViewEnabled: true,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    cardTitleField: 'name',
    cardSubtitleField: 'rateDisplay',
    cardPreviewFieldCount: 2,
    mobileAddRowEnabled: false,
    rowViewActionEnabled: true,
    rowDeleteActionEnabled: true,
  };

  ngOnInit(): void {
    this.loadVatRates();
  }

  private loadVatRates(): void {
    this.loading.set(true);
    this.catalogService.listVatRates({ pageSize: 100 }).subscribe({
      next: (response) => {
        this.vatRates.set(response.items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error(this.translate.instant('catalog.vatRates.errors.loadFailed'));
        this.loading.set(false);
      },
    });
  }

  protected formatRate(rateBps: number): string {
    return `${CatalogService.bpsToRate(rateBps)}%`;
  }

  // Modal handlers
  protected openAddModal(): void {
    this.editingRate.set(null);
    this.formName.set('');
    this.formRate.set(null);
    this.isModalOpen.set(true);
  }

  protected openEditModal(rate: VatRate): void {
    this.editingRate.set(rate);
    this.formName.set(rate.name);
    this.formRate.set(CatalogService.bpsToRate(rate.rateBps));
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
    this.editingRate.set(null);
    this.formName.set('');
    this.formRate.set(null);
  }

  protected saveRate(): void {
    if (!this.isFormValid() || this.saving()) return;

    const rawRate = this.formRate();
    if (rawRate === null || rawRate === undefined) return;
    const rateBps = CatalogService.rateToBps(rawRate);
    const name = this.formName().trim();

    this.saving.set(true);

    if (this.isEditing()) {
      const editing = this.editingRate();
      if (!editing) {
        this.saving.set(false);
        return;
      }
      const rateId = editing.id;
      this.catalogService.updateVatRate(rateId, { name, rateBps }).subscribe({
        next: () => {
          this.toastService.success(this.translate.instant('catalog.vatRates.updateSuccess'));
          this.closeModal();
          this.loadVatRates();
          this.saving.set(false);
        },
        error: () => {
          this.toastService.error(this.translate.instant('catalog.vatRates.errors.updateFailed'));
          this.saving.set(false);
        },
      });
    } else {
      this.catalogService.createVatRate({ name, rateBps }).subscribe({
        next: () => {
          this.toastService.success(this.translate.instant('catalog.vatRates.createSuccess'));
          this.closeModal();
          this.loadVatRates();
          this.saving.set(false);
        },
        error: () => {
          this.toastService.error(this.translate.instant('catalog.vatRates.errors.createFailed'));
          this.saving.set(false);
        },
      });
    }
  }

  // Delete handlers
  protected openDeleteDialog(rate: VatRate): void {
    this.pendingDeleteRate.set(rate);
    this.isDeleteDialogOpen.set(true);
  }

  protected onRowDoubleClick(row: VatRateRow): void {
    this.openEditModal(row);
  }

  protected onDeleteRows(rows: VatRateRow[]): void {
    if (rows.length === 0) return;
    this.openDeleteDialog(rows[0]);
  }

  protected closeDeleteDialog(): void {
    this.isDeleteDialogOpen.set(false);
    this.pendingDeleteRate.set(null);
  }

  protected confirmDelete(): void {
    const rate = this.pendingDeleteRate();
    if (!rate) {
      this.closeDeleteDialog();
      return;
    }

    this.saving.set(true);
    this.catalogService.deleteVatRate(rate.id).subscribe({
      next: () => {
        this.toastService.success(this.translate.instant('catalog.vatRates.deleteSuccess'));
        this.closeDeleteDialog();
        this.loadVatRates();
        this.saving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.toastService.error(this.translate.instant('catalog.vatRates.errors.inUse'));
        } else {
          this.toastService.error(this.translate.instant('catalog.vatRates.errors.deleteFailed'));
        }
        this.closeDeleteDialog();
        this.saving.set(false);
      },
    });
  }
}
