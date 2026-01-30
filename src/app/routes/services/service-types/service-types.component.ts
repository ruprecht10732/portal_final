import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { CreateServiceTypeRequest, ServiceTypeItem, UpdateServiceTypeRequest } from '../../../core/services/service-types.types';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { GridColumn, GridConfig } from '../../../shared/components/data-grid/data-grid.types';
import { CardComponent } from '../../../shared/components/card/card.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

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
  ],
})
export class ServiceTypesComponent implements OnInit {
  private readonly serviceTypesService = inject(ServiceTypesService);

  protected readonly serviceTypes = signal<ServiceTypeRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

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
      sortable: false,
      filterable: false,
      editable: true,
      width: '180px',
      cellType: 'text',
      validator: value => (typeof value === 'string' && value.trim().length > 0 ? null : 'Required'),
    },
    {
      id: 'slug',
      header: 'Slug',
      field: 'slug',
      sortable: false,
      filterable: false,
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
      cellType: 'text',
    },
    {
      id: 'color',
      header: 'Color',
      field: 'color',
      sortable: false,
      filterable: false,
      editable: true,
      width: '120px',
      cellType: 'text',
    },
    {
      id: 'displayOrder',
      header: 'Order',
      field: 'displayOrder',
      sortable: false,
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
      sortable: false,
      filterable: false,
      editable: true,
      width: '90px',
      cellType: 'boolean',
      align: 'center',
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      field: 'updatedAt',
      sortable: false,
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

  protected readonly canCreate = computed(() => this.name().trim().length > 0);

  ngOnInit(): void {
    this.loadServiceTypes();
  }

  private loadServiceTypes(): void {
    this.loading.set(true);
    this.serviceTypesService.listAdmin().subscribe({
      next: (response) => {
        const items = response.items ?? [];
        this.serviceTypes.set(items.map(item => ({ ...item }) as ServiceTypeRow));
        this.loading.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load service types');
        this.loading.set(false);
        this.saving.set(false);
      },
    });
  }

  protected createServiceType(): void {
    if (!this.canCreate() || this.creating()) return;

    this.creating.set(true);
    this.error.set(null);

    const displayOrderValue = this.parseDisplayOrder(this.displayOrder());
    const request: CreateServiceTypeRequest = {
      name: this.name().trim(),
      description: this.normalizeOptional(this.description()),
      icon: this.normalizeOptional(this.icon()),
      color: this.normalizeOptional(this.color()),
      displayOrder: displayOrderValue,
    };

    this.serviceTypesService.create(request).subscribe({
      next: () => {
        this.resetForm();
        this.loadServiceTypes();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to create service type');
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
      const existing = existingMap.get(row.id);
      if (!existing) return;

      const updateRequest = this.buildUpdateRequest(row, existing);
      if (Object.keys(updateRequest).length > 0) {
        requests.push(this.serviceTypesService.update(row.id, updateRequest));
      }

      if (row.isActive !== existing.isActive) {
        requests.push(this.serviceTypesService.toggleActive(row.id));
      }
    });

    if (requests.length === 0) return;

    this.saving.set(true);
    const requestMap = Object.fromEntries(requests.map((request, index) => [index, request]));
    forkJoin(requestMap).subscribe({
      next: () => this.loadServiceTypes(),
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to save service types');
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
        this.loadServiceTypes();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to delete service types');
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
      request.icon = icon;
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

}
