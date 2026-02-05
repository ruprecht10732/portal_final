import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, map, Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { PartnersService } from '../../../core/services/partners.service';
import type { CreatePartnerRequest, ListPartnersParams, Partner, UpdatePartnerRequest } from '../../../core/services/partners.types';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { DataRequest, DataResponse, GridColumn, GridConfig } from '../../../shared/components/data-grid/data-grid.types';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FabButtonComponent } from '../../../shared/components/fab-button/fab-button.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { DEFAULT_PAGE_SIZE } from '../../../core/config';

export type PartnerRow = Partner & Record<string, unknown>;

const KVK_PATTERN = /^[0-9]{8}$/;
const VAT_PATTERN = /^NL[0-9]{9}B[0-9]{2}$/i;
const MAX_LENGTHS = {
  businessName: 200,
  kvkNumber: 20,
  vatNumber: 20,
  addressLine1: 200,
  addressLine2: 200,
  postalCode: 20,
  city: 120,
  country: 120,
  contactName: 120,
  contactPhone: 50,
} as const;

@Component({
  selector: 'app-partners-list',
  templateUrl: './partners-list.component.html',
  styleUrl: './partners-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataGridComponent,
    ConfirmDialogComponent,
    FabButtonComponent,
    PageLayoutComponent,
    TranslatePipe,
  ],
})
export class PartnersListComponent implements OnInit {
  private readonly partnersService = inject(PartnersService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly partners = signal<PartnerRow[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private ignoreNextRequest = true;

  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly pendingDeleteRows = signal<PartnerRow[]>([]);
  protected readonly deleteCount = computed(() => this.pendingDeleteRows().length);

  protected readonly columns = computed<GridColumn<PartnerRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'businessName',
        header: this.translate.instant('partners.list.columns.businessName'),
        field: 'businessName',
        sortable: true,
        filterable: true,
        editable: true,
        width: '220px',
        cellType: 'text',
        validator: value => this.requiredMaxLengthValidator(value, MAX_LENGTHS.businessName),
      },
      {
        id: 'contactName',
        header: this.translate.instant('partners.list.columns.contactName'),
        field: 'contactName',
        sortable: true,
        filterable: true,
        editable: true,
        width: '180px',
        cellType: 'text',
        validator: value => this.requiredMaxLengthValidator(value, MAX_LENGTHS.contactName),
      },
      {
        id: 'contactEmail',
        header: this.translate.instant('partners.list.columns.contactEmail'),
        field: 'contactEmail',
        sortable: true,
        filterable: true,
        editable: true,
        width: '220px',
        cellType: 'text',
        validator: value => this.emailValidator(value),
      },
      {
        id: 'contactPhone',
        header: this.translate.instant('partners.list.columns.contactPhone'),
        field: 'contactPhone',
        sortable: true,
        filterable: true,
        editable: true,
        width: '160px',
        cellType: 'text',
        validator: value => this.requiredMaxLengthValidator(value, MAX_LENGTHS.contactPhone),
      },
      {
        id: 'kvkNumber',
        header: this.translate.instant('partners.list.columns.kvkNumber'),
        field: 'kvkNumber',
        sortable: true,
        filterable: true,
        editable: true,
        width: '140px',
        cellType: 'text',
        validator: value => this.kvkValidator(value),
      },
      {
        id: 'vatNumber',
        header: this.translate.instant('partners.list.columns.vatNumber'),
        field: 'vatNumber',
        sortable: true,
        filterable: true,
        editable: true,
        width: '160px',
        cellType: 'text',
        validator: value => this.vatValidator(value),
      },
      {
        id: 'addressLine1',
        header: this.translate.instant('partners.list.columns.addressLine1'),
        field: 'addressLine1',
        sortable: false,
        filterable: true,
        editable: true,
        width: '220px',
        cellType: 'text',
        validator: value => this.requiredMaxLengthValidator(value, MAX_LENGTHS.addressLine1),
      },
      {
        id: 'addressLine2',
        header: this.translate.instant('partners.list.columns.addressLine2'),
        field: 'addressLine2',
        sortable: false,
        filterable: true,
        editable: true,
        width: '200px',
        cellType: 'text',
        validator: value => this.optionalMaxLengthValidator(value, MAX_LENGTHS.addressLine2),
      },
      {
        id: 'postalCode',
        header: this.translate.instant('partners.list.columns.postalCode'),
        field: 'postalCode',
        sortable: true,
        filterable: true,
        editable: true,
        width: '120px',
        cellType: 'text',
        validator: value => this.requiredMaxLengthValidator(value, MAX_LENGTHS.postalCode),
      },
      {
        id: 'city',
        header: this.translate.instant('partners.list.columns.city'),
        field: 'city',
        sortable: true,
        filterable: true,
        editable: true,
        width: '140px',
        cellType: 'text',
        validator: value => this.requiredMaxLengthValidator(value, MAX_LENGTHS.city),
      },
      {
        id: 'country',
        header: this.translate.instant('partners.list.columns.country'),
        field: 'country',
        sortable: true,
        filterable: true,
        editable: true,
        width: '140px',
        cellType: 'text',
        validator: value => this.requiredMaxLengthValidator(value, MAX_LENGTHS.country),
      },
      {
        id: 'createdAt',
        header: this.translate.instant('partners.list.columns.createdAt'),
        field: 'createdAt',
        sortable: true,
        filterable: false,
        editable: false,
        width: '140px',
        cellType: 'date',
      },
    ];
  });

  protected readonly gridConfig: Partial<GridConfig<PartnerRow>> = {
    rowIdField: 'id',
    selectable: true,
    cardViewEnabled: true,
    mobileBreakpoint: 640,
    cardTitleField: 'businessName',
    cardSubtitleField: 'contactName',
    cardSecondarySubtitleField: 'contactEmail',
    cardPreviewFieldCount: 4,
    rowViewActionEnabled: true,
    rowDeleteActionEnabled: true,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);

  ngOnInit(): void {
    this.loadInitialData();
  }

  protected addPartner(): void {
    this.router.navigate(['/app/partners/new']);
  }

  protected onRowDoubleClick(row: PartnerRow): void {
    if (!row?.id) return;
    this.router.navigate(['/app/partners', row.id]);
  }

  private loadPartners(params: ListPartnersParams): void {
    this.loading.set(true);
    this.partnersService.list(params).subscribe({
      next: (response) => {
        const items = response.items ?? [];
        this.partners.set(items.map(item => ({ ...item }) as PartnerRow));
        this.total.set(response.total ?? items.length);
        this.loading.set(false);
        this.saving.set(false);
        this.ignoreNextRequest = true;
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
        this.saving.set(false);
      },
    });
  }

  private loadInitialData(): void {
    this.loadPartners({ page: 1, pageSize: DEFAULT_PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'desc' });
  }

  protected onSavePartners(rows: PartnerRow[]): void {
    const existingMap = new Map(this.partners().map(item => [item.id, item]));
    const requests: Observable<unknown>[] = [];

    rows.forEach(row => {
      const rowId = (row as Partial<PartnerRow>).id;

      if (!rowId) {
        const createRequest = this.buildCreateRequest(row);
        if (!createRequest) return;
        requests.push(this.partnersService.create(createRequest));
        return;
      }

      const existing = existingMap.get(rowId);
      if (!existing) return;

      const updateRequest = this.buildUpdateRequest(row, existing);
      if (Object.keys(updateRequest).length > 0) {
        requests.push(this.partnersService.update(rowId, updateRequest));
      }
    });

    if (requests.length === 0) return;

    this.saving.set(true);
    const requestMap = Object.fromEntries(requests.map((request, index) => [index, request]));
    forkJoin(requestMap).subscribe({
      next: () => this.loadInitialData(),
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.saveFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected onDeleteRows(rows: PartnerRow[]): void {
    if (rows.length === 0) return;
    this.pendingDeleteRows.set(rows);
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

    this.saving.set(true);
    const requests = rows.map(row => this.partnersService.delete(row.id));
    const requestMap = Object.fromEntries(requests.map((request, index) => [index, request]));
    forkJoin(requestMap).subscribe({
      next: () => {
        this.closeDeleteDialog();
        this.loadInitialData();
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.deleteFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected fetchData(request: DataRequest): Observable<DataResponse<PartnerRow>> {
    const sortBy = request.sort?.columnId as ListPartnersParams['sortBy'];
    const sortOrder = request.sort?.direction;
    const params: ListPartnersParams = {
      page: request.page,
      pageSize: request.pageSize,
      ...(sortBy !== undefined && { sortBy }),
      ...(sortOrder !== undefined && { sortOrder }),
    };

    if (request.searchTerm) {
      params.search = request.searchTerm;
    }

    return this.partnersService.list(params).pipe(
      map(response => ({
        data: (response.items ?? []).map(item => ({ ...item }) as PartnerRow),
        totalItems: response.total ?? 0,
        page: response.page ?? request.page,
        pageSize: response.pageSize ?? request.pageSize,
      }))
    );
  }

  protected onDataRequest(request: DataRequest): void {
    if (this.ignoreNextRequest) {
      this.ignoreNextRequest = false;
      return;
    }

    this.loading.set(true);
    this.fetchData(request).subscribe({
      next: (response) => {
        this.partners.set(response.data);
        this.total.set(response.totalItems);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private buildCreateRequest(row: PartnerRow): CreatePartnerRequest | null {
    const businessName = this.normalizeRequired(row.businessName);
    const kvkNumber = this.normalizeRequired(row.kvkNumber);
    const vatNumber = this.normalizeRequired(row.vatNumber);
    const addressLine1 = this.normalizeRequired(row.addressLine1);
    const postalCode = this.normalizeRequired(row.postalCode);
    const city = this.normalizeRequired(row.city);
    const country = this.normalizeRequired(row.country);
    const contactName = this.normalizeRequired(row.contactName);
    const contactEmail = this.normalizeRequired(row.contactEmail);
    const contactPhone = this.normalizeRequired(row.contactPhone);
    const addressLine2 = this.normalizeOptional(row.addressLine2);

    const requiredValues = [
      businessName,
      kvkNumber,
      vatNumber,
      addressLine1,
      postalCode,
      city,
      country,
      contactName,
      contactEmail,
      contactPhone,
    ];
    if (requiredValues.some(value => !value)) return null;

    return {
      businessName: businessName!,
      kvkNumber: kvkNumber!,
      vatNumber: vatNumber!,
      addressLine1: addressLine1!,
      ...(addressLine2 && { addressLine2 }),
      postalCode: postalCode!,
      city: city!,
      country: country!,
      contactName: contactName!,
      contactEmail: contactEmail!,
      contactPhone: contactPhone!,
    };
  }

  private buildUpdateRequest(row: PartnerRow, existing: Partner): UpdatePartnerRequest {
    const updates: {
      key: keyof UpdatePartnerRequest;
      value: string | null | undefined;
      existingValue: string | null | undefined;
    }[] = [
      { key: 'businessName', value: this.normalizeOptional(row.businessName), existingValue: existing.businessName },
      { key: 'kvkNumber', value: this.normalizeOptional(row.kvkNumber), existingValue: existing.kvkNumber },
      { key: 'vatNumber', value: this.normalizeOptional(row.vatNumber), existingValue: existing.vatNumber },
      { key: 'addressLine1', value: this.normalizeOptional(row.addressLine1), existingValue: existing.addressLine1 },
      { key: 'addressLine2', value: this.normalizeNullable(row.addressLine2, existing.addressLine2 ?? null), existingValue: existing.addressLine2 ?? null },
      { key: 'postalCode', value: this.normalizeOptional(row.postalCode), existingValue: existing.postalCode },
      { key: 'city', value: this.normalizeOptional(row.city), existingValue: existing.city },
      { key: 'country', value: this.normalizeOptional(row.country), existingValue: existing.country },
      { key: 'contactName', value: this.normalizeOptional(row.contactName), existingValue: existing.contactName },
      { key: 'contactEmail', value: this.normalizeOptional(row.contactEmail), existingValue: existing.contactEmail },
      { key: 'contactPhone', value: this.normalizeOptional(row.contactPhone), existingValue: existing.contactPhone },
    ];

    return updates.reduce<UpdatePartnerRequest>((request, update) => {
      if (update.value !== undefined && update.value !== update.existingValue) {
        const target = request as Record<string, string | null>;
        target[update.key] = update.value;
      }
      return request;
    }, {});
  }

  private normalizeRequired(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  }

  private normalizeOptional(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }

  private normalizeNullable(value: unknown, existingValue: string | null): string | null | undefined {
    if (value === null || value === undefined) {
      return existingValue === null ? undefined : null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return existingValue === null ? undefined : null;
      }
      if (trimmed !== existingValue) {
        return trimmed;
      }
      return undefined;
    }
    return undefined;
  }

  private requiredMaxLengthValidator(value: unknown, maxLength: number): string | null {
    const normalized = this.normalizeRequired(value);
    if (!normalized) return this.translate.instant('partners.list.validation.required');
    if (normalized.length > maxLength) return this.maxLengthMessage(maxLength);
    return null;
  }

  private optionalMaxLengthValidator(value: unknown, maxLength: number): string | null {
    const normalized = this.normalizeOptional(value);
    if (!normalized) return null;
    if (normalized.length > maxLength) return this.maxLengthMessage(maxLength);
    return null;
  }

  private kvkValidator(value: unknown): string | null {
    const normalized = this.normalizeRequired(value);
    if (!normalized) return this.translate.instant('partners.list.validation.required');
    if (normalized.length > MAX_LENGTHS.kvkNumber) return this.maxLengthMessage(MAX_LENGTHS.kvkNumber);
    return KVK_PATTERN.test(normalized)
      ? null
      : this.translate.instant('partners.list.validation.invalidKvk');
  }

  private vatValidator(value: unknown): string | null {
    const normalized = this.normalizeRequired(value);
    if (!normalized) return this.translate.instant('partners.list.validation.required');
    if (normalized.length > MAX_LENGTHS.vatNumber) return this.maxLengthMessage(MAX_LENGTHS.vatNumber);
    return VAT_PATTERN.test(normalized)
      ? null
      : this.translate.instant('partners.list.validation.invalidVat');
  }

  private emailValidator(value: unknown): string | null {
    const normalized = this.normalizeRequired(value);
    if (!normalized) return this.translate.instant('partners.list.validation.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return this.translate.instant('partners.list.validation.invalidEmail');
    }
    return null;
  }

  private maxLengthMessage(maxLength: number): string {
    return this.translate.instant('partners.list.validation.maxLength', { max: maxLength });
  }
}
