import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable } from 'rxjs';
import { LeadsService } from '../../../core/services/leads.service';
import type { Lead, ListLeadsParams, SortField } from '../../../core/services/leads.types';
import { STATUS_LABELS, STATUS_OPTIONS, SERVICE_TYPE_OPTIONS } from '../../../core/services/leads.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { GridColumn, GridConfig, DataRequest, DataResponse, SelectionChangeEvent } from '../../../shared/components/data-grid/data-grid.types';

type LeadRow = Lead & Record<string, unknown>;

@Component({
  selector: 'app-lead-list',
  templateUrl: './lead-list.component.html',
  styleUrl: './lead-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DataGridComponent],
})
export class LeadListComponent implements OnInit {
  private readonly leadsService = inject(LeadsService);
  private readonly router = inject(Router);

  protected readonly leads = signal<LeadRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);

  protected readonly columns: GridColumn<LeadRow>[] = [
    {
      id: 'name',
      header: 'Name',
      field: 'consumer',
      sortable: true,
      width: '180px',
      cellType: 'custom',
      templateId: 'name',
    },
    {
      id: 'phone',
      header: 'Phone',
      field: 'consumer.phone' as keyof LeadRow,
      width: '130px',
      cellType: 'text',
    },
    {
      id: 'address',
      header: 'Address',
      field: 'address',
      width: '220px',
      cellType: 'custom',
      templateId: 'address',
    },
    {
      id: 'serviceType',
      header: 'Service',
      field: 'serviceType',
      sortable: true,
      filterable: true,
      width: '120px',
      cellType: 'select',
      selectOptions: SERVICE_TYPE_OPTIONS,
    },
    {
      id: 'status',
      header: 'Status',
      field: 'status',
      sortable: true,
      filterable: true,
      width: '140px',
      cellType: 'select',
      selectOptions: STATUS_OPTIONS.map(opt => ({
        label: STATUS_LABELS[opt.value],
        value: opt.value,
      })),
    },
    {
      id: 'createdAt',
      header: 'Created',
      field: 'createdAt',
      sortable: true,
      width: '110px',
      cellType: 'date',
    },
  ];

  protected readonly gridConfig: Partial<GridConfig<LeadRow>> = {
    rowIdField: 'id',
    selectable: false,
    cardViewEnabled: true,
    mobileBreakpoint: 640,
    cardTitleField: 'consumer' as keyof LeadRow,
    cardPreviewFieldCount: 4,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.leadsService.list({ page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' }).subscribe({
      next: (response) => {
        this.leads.set(response.items as LeadRow[]);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load leads');
        this.loading.set(false);
      },
    });
  }

  protected fetchData(request: DataRequest): Observable<DataResponse<LeadRow>> {
    const sortFieldMap: Record<string, SortField> = {
      name: 'firstName',
      createdAt: 'createdAt',
      status: 'status',
      serviceType: 'createdAt', // fallback, serviceType not sortable in backend
    };

    const params: ListLeadsParams = {
      page: request.page,
      pageSize: request.pageSize,
      sortBy: sortFieldMap[request.sort?.columnId ?? 'createdAt'] ?? 'createdAt',
      sortOrder: request.sort?.direction || 'desc',
    };

    if (request.searchTerm) {
      params.search = request.searchTerm;
    }

    // Map filters to params
    for (const filter of request.filters) {
      if (filter.columnId === 'status') {
        params.status = filter.value as ListLeadsParams['status'];
      } else if (filter.columnId === 'serviceType') {
        params.serviceType = filter.value as ListLeadsParams['serviceType'];
      }
    }

    return this.leadsService.list(params).pipe(
      map(response => ({
        data: response.items as LeadRow[],
        totalItems: response.total,
        page: response.page,
        pageSize: response.pageSize,
      }))
    );
  }

  protected onDataRequest(request: DataRequest): void {
    this.loading.set(true);
    this.fetchData(request).subscribe({
      next: (response) => {
        this.leads.set(response.data);
        this.total.set(response.totalItems);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load leads');
        this.loading.set(false);
      },
    });
  }

  protected onRowClick(event: SelectionChangeEvent<LeadRow>): void {
    if (event.selectedRows.length === 1) {
      this.router.navigate(['/app/leads', event.selectedRows[0].id]);
    }
  }

  protected createLead(): void {
    this.router.navigate(['/app/leads/new']);
  }
}
