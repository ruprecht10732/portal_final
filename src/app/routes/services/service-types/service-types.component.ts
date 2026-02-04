import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { CreateServiceTypeRequest, ListServiceTypesParams, ServiceTypeItem, UpdateServiceTypeRequest } from '../../../core/services/service-types.types';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { DataRequest, DataResponse, GridColumn, GridConfig } from '../../../shared/components/data-grid/data-grid.types';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { normalizeIconName } from '../../../core/services/icon-utils';
import { FabButtonComponent } from '../../../shared/components/fab-button/fab-button.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { DEFAULT_PAGE_SIZE } from '../../../core/config';

export type ServiceTypeRow = ServiceTypeItem & Record<string, unknown>;

@Component({
  selector: 'app-service-types',
  templateUrl: './service-types.component.html',
  styleUrl: './service-types.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataGridComponent,
    ConfirmDialogComponent,
    FabButtonComponent,
    PageLayoutComponent,
    TranslatePipe,
  ],
})
export class ServiceTypesComponent implements OnInit {
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly serviceTypes = signal<ServiceTypeRow[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private ignoreNextRequest = true;

  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly pendingDeleteRows = signal<ServiceTypeRow[]>([]);
  protected readonly deleteCount = computed(() => this.pendingDeleteRows().length);

  protected readonly columns = computed<GridColumn<ServiceTypeRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'name',
        header: this.translate.instant('services.list.columns.name'),
        field: 'name',
        sortable: true,
        filterable: true,
        editable: true,
        width: '180px',
        cellType: 'text',
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('services.validation.required')),
      },
      {
        id: 'slug',
        header: this.translate.instant('services.list.columns.slug'),
        field: 'slug',
        sortable: true,
        filterable: true,
        editable: false,
        width: '160px',
        cellType: 'text',
      },
      {
        id: 'description',
        header: this.translate.instant('services.list.columns.description'),
        field: 'description',
        sortable: false,
        filterable: false,
        editable: true,
        width: '240px',
        cellType: 'text',
      },
      {
        id: 'intakeGuidelines',
        header: this.translate.instant('services.list.columns.intakeGuidelines'),
        field: 'intakeGuidelines',
        sortable: false,
        filterable: false,
        editable: true,
        width: '280px',
        cellType: 'text',
      },
      {
        id: 'icon',
        header: this.translate.instant('services.list.columns.icon'),
        field: 'icon',
        sortable: false,
        filterable: false,
        editable: true,
        width: '120px',
        cellType: 'icon',
      },
      {
        id: 'color',
        header: this.translate.instant('services.list.columns.color'),
        field: 'color',
        sortable: false,
        filterable: false,
        editable: true,
        width: '120px',
        cellType: 'color',
        validator: (value) => {
          if (value === null || value === undefined || value === '') return null;
          if (typeof value !== 'string') return this.translate.instant('services.validation.invalid');
          return /^#[0-9a-fA-F]{6}$/.test(value.trim())
            ? null
            : this.translate.instant('services.validation.colorFormat');
        },
      },
      {
        id: 'displayOrder',
        header: this.translate.instant('services.list.columns.order'),
        field: 'displayOrder',
        sortable: true,
        filterable: false,
        editable: true,
        width: '90px',
        cellType: 'number',
        validator: value => {
          const num = Number(value);
          return Number.isFinite(num) && num >= 0
            ? null
            : this.translate.instant('services.validation.invalid');
        },
      },
      {
        id: 'isActive',
        header: this.translate.instant('services.list.columns.active'),
        field: 'isActive',
        sortable: true,
        filterable: true,
        editable: true,
        width: '90px',
        cellType: 'boolean',
        align: 'center',
      },
      {
        id: 'updatedAt',
        header: this.translate.instant('services.list.columns.updated'),
        field: 'updatedAt',
        sortable: true,
        filterable: false,
        editable: false,
        width: '140px',
        cellType: 'date',
      },
    ];
  });

  protected readonly gridConfig: Partial<GridConfig<ServiceTypeRow>> = {
    rowIdField: 'id',
    selectable: true,
    cardViewEnabled: true,
    mobileBreakpoint: 640,
    cardTitleField: 'name',
    cardSubtitleField: 'slug',
    cardSecondarySubtitleField: 'description',
    cardPreviewFieldCount: 4,
    rowViewActionEnabled: true,
    rowDeleteActionEnabled: true,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);

  ngOnInit(): void {
    this.loadInitialData();
  }

  protected goToCreate(): void {
    this.router.navigate(['/app/services/new']);
  }

  private loadServiceTypes(params: ListServiceTypesParams): void {
    this.loading.set(true);
    this.serviceTypesService.listAdmin(params).subscribe({
      next: (response) => {
        const items = response.items ?? [];
        this.serviceTypes.set(items.map(item => ({ ...item }) as ServiceTypeRow));
        this.total.set(response.total ?? items.length);
        this.loading.set(false);
        this.saving.set(false);
        this.ignoreNextRequest = true;
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('services.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
        this.saving.set(false);
      },
    });
  }

  private loadInitialData(): void {
    this.loadServiceTypes({ page: 1, pageSize: DEFAULT_PAGE_SIZE, sortBy: 'displayOrder', sortOrder: 'asc' });
  }

  protected onSaveServiceTypes(rows: ServiceTypeRow[]): void {
    const existingMap = new Map(this.serviceTypes().map(item => [item.id, item]));
    const requests: Observable<unknown>[] = [];

    rows.forEach(row => {
      const rowId = (row as Partial<ServiceTypeRow>).id;

      // New rows may not have an id yet (client-side only)
      if (!rowId) {
        const createRequest = this.buildCreateRequest(row);
        if (!createRequest) return;

        requests.push(
          this.serviceTypesService.create(createRequest).pipe(
            switchMap((created) => {
              if (row.isActive === false) {
                return this.serviceTypesService.toggleActive(created.id);
              }
              return of(created);
            })
          )
        );
        return;
      }

      const existing = existingMap.get(rowId);
      if (!existing) return;

      const updateRequest = this.buildUpdateRequest(row, existing);
      if (Object.keys(updateRequest).length > 0) {
        requests.push(this.serviceTypesService.update(rowId, updateRequest));
      }

      if (row.isActive !== existing.isActive) {
        requests.push(this.serviceTypesService.toggleActive(rowId));
      }
    });

    if (requests.length === 0) return;

    this.saving.set(true);
    const requestMap = Object.fromEntries(requests.map((request, index) => [index, request]));
    forkJoin(requestMap).subscribe({
      next: () => this.loadInitialData(),
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('services.errors.saveFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected onDeleteRows(rows: ServiceTypeRow[]): void {
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
    const requests = rows.map(row => this.serviceTypesService.delete(row.id));
    const requestMap = Object.fromEntries(requests.map((request, index) => [index, request]));
    forkJoin(requestMap).subscribe({
      next: () => {
        this.closeDeleteDialog();
        this.loadInitialData();
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('services.errors.deleteFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  private buildUpdateRequest(row: ServiceTypeRow, existing: ServiceTypeItem): UpdateServiceTypeRequest {
    const request: UpdateServiceTypeRequest = {};

    const name = this.normalizeOptional(row.name);
    if (name && name !== existing.name) {
      request.name = name;
    }

    const description = this.normalizeNullable(row.description, existing.description ?? null);
    if (description !== undefined && description !== null) {
      request.description = description;
    } else if (description === null) {
      request.description = null;
    }

    const intakeGuidelines = this.normalizeNullable(row.intakeGuidelines, existing.intakeGuidelines ?? null);
    if (intakeGuidelines !== undefined && intakeGuidelines !== null) {
      request.intakeGuidelines = intakeGuidelines;
    } else if (intakeGuidelines === null) {
      request.intakeGuidelines = null;
    }

    const icon = this.normalizeNullable(row.icon, existing.icon ?? null);
    if (icon !== undefined && icon !== null) {
      const normalized = normalizeIconName(icon);
      if (normalized !== undefined) {
        request.icon = normalized;
      }
    } else if (icon === null) {
      request.icon = null;
    }

    const color = this.normalizeNullable(row.color, existing.color ?? null);
    if (color !== undefined && color !== null) {
      request.color = color;
    } else if (color === null) {
      request.color = null;
    }

    const displayOrder = this.parseDisplayOrder(row.displayOrder);
    if (displayOrder !== undefined && displayOrder !== existing.displayOrder) {
      request.displayOrder = displayOrder;
    }

    return request;
  }

  private buildCreateRequest(row: ServiceTypeRow): CreateServiceTypeRequest | null {
    const name = this.normalizeOptional(row.name);
    if (!name) return null;

    const rawIcon = normalizeIconName(this.normalizeOptional(row.icon));
    // Filter out null - only include if it's a valid string
    const icon = rawIcon === null ? undefined : rawIcon;
    const displayOrder = this.parseDisplayOrder(row.displayOrder);
    const description = this.normalizeOptional(row.description);
    const intakeGuidelines = this.normalizeOptional(row.intakeGuidelines);
    const color = this.normalizeOptional(row.color);

    return {
      name,
      ...(description !== undefined && { description }),
      ...(intakeGuidelines !== undefined && { intakeGuidelines }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(displayOrder !== undefined && { displayOrder }),
    };
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
    if (typeof value === 'number' && Number.isFinite(value)) {
      const stringValue = String(value);
      if (stringValue !== existingValue) {
        return stringValue;
      }
      return undefined;
    }
    return undefined;
  }

  private parseDisplayOrder(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    return parsed;
  }

  protected fetchData(request: DataRequest): Observable<DataResponse<ServiceTypeRow>> {
    const sortBy = request.sort?.columnId as ListServiceTypesParams['sortBy'];
    const sortOrder = request.sort?.direction;
    const params: ListServiceTypesParams = {
      page: request.page,
      pageSize: request.pageSize,
      ...(sortBy !== undefined && { sortBy }),
      ...(sortOrder !== undefined && { sortOrder }),
    };

    if (request.searchTerm) {
      params.search = request.searchTerm;
    }

    const searchFilters: string[] = [];

    for (const filter of request.filters) {
      if (filter.columnId === 'isActive') {
        const normalized = filter.value.trim().toLowerCase();
        if (['true', 'active', 'yes', '1'].includes(normalized)) {
          params.isActive = true;
        } else if (['false', 'inactive', 'no', '0'].includes(normalized)) {
          params.isActive = false;
        }
        continue;
      }

      if (['name', 'slug', 'description', 'intakeGuidelines', 'icon', 'color'].includes(filter.columnId)) {
        if (filter.value.trim()) {
          searchFilters.push(filter.value.trim());
        }
      }
    }

    if (!params.search && searchFilters.length > 0) {
      params.search = searchFilters.join(' ');
    }

    return this.serviceTypesService.listAdmin(params).pipe(
      map(response => ({
        data: (response.items ?? []).map(item => ({ ...item }) as ServiceTypeRow),
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
        this.serviceTypes.set(response.data);
        this.total.set(response.totalItems);
        this.loading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('services.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected onServiceTypeDoubleClick(row: ServiceTypeRow): void {
    if (row.id) {
      this.router.navigate(['/app/services', row.id]);
    }
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
