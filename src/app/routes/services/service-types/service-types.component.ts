import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { CreateServiceTypeRequest, ListServiceTypesParams, ServiceTypeItem, UpdateServiceTypeRequest } from '../../../core/services/service-types.types';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { DataRequest, DataResponse, GridColumn, GridConfig } from '../../../shared/components/data-grid/data-grid.types';
import { CardComponent } from '../../../shared/components/card/card.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { normalizeIconName } from '../../../core/services/icon-utils';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';
import { ColorPickerComponent } from '../../../shared/components/color-picker/color-picker.component';
import { FabButtonComponent } from '../../../shared/components/fab-button/fab-button.component';
import { DEFAULT_PAGE_SIZE } from '../../../core/config';

export type ServiceTypeRow = ServiceTypeItem & Record<string, unknown>;

@Component({
  selector: 'app-service-types',
  templateUrl: './service-types.component.html',
  styleUrl: './service-types.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataGridComponent,
    CardComponent,
    InputComponent,
    TextareaComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    IconPickerComponent,
    ColorPickerComponent,
    FabButtonComponent,
  ],
})
export class ServiceTypesComponent implements OnInit {
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly serviceTypes = signal<ServiceTypeRow[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);
  private ignoreNextRequest = true;

  protected readonly isCreateMode = signal(false);

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly icon = signal('');
  protected readonly color = signal('');
  protected readonly displayOrder = signal('0');

  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly pendingDeleteRows = signal<ServiceTypeRow[]>([]);
  protected readonly deleteCount = computed(() => this.pendingDeleteRows().length);

  protected readonly columns: GridColumn<ServiceTypeRow>[] = [
    {
      id: 'name',
      header: 'Name',
      field: 'name',
      sortable: true,
      filterable: true,
      editable: true,
      width: '180px',
      cellType: 'text',
      validator: value => (typeof value === 'string' && value.trim().length > 0 ? null : 'Required'),
    },
    {
      id: 'slug',
      header: 'Slug',
      field: 'slug',
      sortable: true,
      filterable: true,
      editable: false,
      width: '160px',
      cellType: 'text',
    },
    {
      id: 'description',
      header: 'Description',
      field: 'description',
      sortable: false,
      filterable: false,
      editable: true,
      width: '240px',
      cellType: 'text',
    },
    {
      id: 'icon',
      header: 'Icon',
      field: 'icon',
      sortable: false,
      filterable: false,
      editable: true,
      width: '120px',
      cellType: 'icon',
    },
    {
      id: 'color',
      header: 'Color',
      field: 'color',
      sortable: false,
      filterable: false,
      editable: true,
      width: '120px',
      cellType: 'color',
      validator: (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value !== 'string') return 'Invalid';
        return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? null : 'Use #RRGGBB';
      },
    },
    {
      id: 'displayOrder',
      header: 'Order',
      field: 'displayOrder',
      sortable: true,
      filterable: false,
      editable: true,
      width: '90px',
      cellType: 'number',
      validator: value => {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? null : 'Invalid';
      },
    },
    {
      id: 'isActive',
      header: 'Active',
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
      header: 'Updated',
      field: 'updatedAt',
      sortable: true,
      filterable: false,
      editable: false,
      width: '140px',
      cellType: 'date',
    },
  ];

  protected readonly gridConfig: Partial<GridConfig<ServiceTypeRow>> = {
    rowIdField: 'id',
    selectable: true,
    cardViewEnabled: true,
    mobileBreakpoint: 640,
    cardTitleField: 'name',
    cardSubtitleField: 'slug',
    cardSecondarySubtitleField: 'description',
    cardPreviewFieldCount: 4,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);

  protected readonly canCreate = computed(() => this.name().trim().length > 0);

  ngOnInit(): void {
    const mode = this.route.snapshot.data['mode'];
    this.isCreateMode.set(mode === 'create');

    if (!this.isCreateMode()) {
      this.loadInitialData();
    }
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
        const message = this.getErrorMessage(err, 'Failed to load service types');
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

  protected createServiceType(): void {
    if (!this.canCreate() || this.creating()) return;

    this.creating.set(true);
    this.error.set(null);

    const displayOrderValue = this.parseDisplayOrder(this.displayOrder());
    const normalizedIcon = normalizeIconName(this.normalizeOptional(this.icon()));
    const request: CreateServiceTypeRequest = {
      name: this.name().trim(),
      description: this.normalizeOptional(this.description()),
      icon: normalizedIcon ?? undefined,
      color: this.normalizeOptional(this.color()),
      displayOrder: displayOrderValue,
    };

    this.serviceTypesService.create(request).subscribe({
      next: () => {
        this.resetForm();
        this.loadInitialData();
      },
      error: (err) => {
        const message = this.getErrorMessage(err, 'Failed to create service type');
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.creating.set(false);
      },
    });
  }

  protected resetForm(): void {
    this.name.set('');
    this.description.set('');
    this.icon.set('');
    this.color.set('');
    this.displayOrder.set('0');
    this.creating.set(false);
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
        const message = this.getErrorMessage(err, 'Failed to save service types');
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
        const message = this.getErrorMessage(err, 'Failed to delete service types');
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
    if (description !== undefined) {
      request.description = description;
    }

    const icon = this.normalizeNullable(row.icon, existing.icon ?? null);
    if (icon !== undefined) {
      request.icon = normalizeIconName(icon);
    }

    const color = this.normalizeNullable(row.color, existing.color ?? null);
    if (color !== undefined) {
      request.color = color;
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

    const icon = normalizeIconName(this.normalizeOptional(row.icon));
    const displayOrder = this.parseDisplayOrder(row.displayOrder);

    return {
      name,
      description: this.normalizeOptional(row.description),
      icon: icon ?? undefined,
      color: this.normalizeOptional(row.color),
      displayOrder,
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
    const params: ListServiceTypesParams = {
      page: request.page,
      pageSize: request.pageSize,
      sortBy: request.sort?.columnId as ListServiceTypesParams['sortBy'],
      sortOrder: request.sort?.direction,
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

      if (['name', 'slug', 'description', 'icon', 'color'].includes(filter.columnId)) {
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
        const message = this.getErrorMessage(err, 'Failed to load service types');
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
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
