import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, Observable } from 'rxjs';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { LeadsService } from '../../../core/services/leads.service';
import type { Lead, ListLeadsParams, SortField, CreateLeadRequest } from '../../../core/services/leads.types';
import { STATUS_LABELS, STATUS_OPTIONS, SERVICE_TYPE_OPTIONS, CONSUMER_ROLE_OPTIONS } from '../../../core/services/leads.types';
import { FabButtonComponent } from '../../../shared/components/fab-button/fab-button.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { GridColumn, GridConfig, DataRequest, DataResponse } from '../../../shared/components/data-grid/data-grid.types';

type LeadRow = Lead & Record<string, unknown>;

@Component({
  selector: 'app-lead-list',
  templateUrl: './lead-list.component.html',
  styleUrl: './lead-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FabButtonComponent, DataGridComponent],
})
export class LeadListComponent implements OnInit {
  private readonly leadsService = inject(LeadsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly leads = signal<LeadRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);
  private ignoreNextRequest = true;
  private readonly phoneRegion = 'NL';

  protected readonly columns: GridColumn<LeadRow>[] = [
    {
      id: 'firstName',
      header: 'First Name',
      field: 'consumer.firstName' as keyof LeadRow,
      sortable: true,
      editable: true,
      width: '140px',
      cellType: 'text',
      validator: value => (typeof value === 'string' && value.trim().length > 0 ? null : 'Required'),
    },
    {
      id: 'lastName',
      header: 'Last Name',
      field: 'consumer.lastName' as keyof LeadRow,
      sortable: true,
      editable: true,
      width: '140px',
      cellType: 'text',
      validator: value => (typeof value === 'string' && value.trim().length > 0 ? null : 'Required'),
    },
    {
      id: 'phone',
      header: 'Phone',
      field: 'consumer.phone' as keyof LeadRow,
      editable: true,
      width: '130px',
      cellType: 'text',
      validator: value => {
        let text = '';
        if (typeof value === 'string') {
          text = value;
        } else if (typeof value === 'number') {
          text = value.toString();
        }
        return text.trim().length >= 5 ? null : 'Min 5 chars';
      },
    },
    {
      id: 'role',
      header: 'Role',
      field: 'consumer.role' as keyof LeadRow,
      editable: true,
      width: '120px',
      cellType: 'select',
      selectOptions: CONSUMER_ROLE_OPTIONS,
      validator: value => CONSUMER_ROLE_OPTIONS.some(opt => opt.value === value) ? null : 'Required',
    },
    {
      id: 'street',
      header: 'Street',
      field: 'address.street' as keyof LeadRow,
      editable: true,
      width: '160px',
      cellType: 'text',
      validator: value => (typeof value === 'string' && value.trim().length > 0 ? null : 'Required'),
    },
    {
      id: 'houseNumber',
      header: 'House No.',
      field: 'address.houseNumber' as keyof LeadRow,
      editable: true,
      width: '110px',
      cellType: 'text',
      validator: value => (typeof value === 'string' && value.trim().length > 0 ? null : 'Required'),
    },
    {
      id: 'zipCode',
      header: 'Zip Code',
      field: 'address.zipCode' as keyof LeadRow,
      editable: true,
      width: '110px',
      cellType: 'text',
      validator: value => (typeof value === 'string' && value.trim().length > 0 ? null : 'Required'),
    },
    {
      id: 'city',
      header: 'City',
      field: 'address.city' as keyof LeadRow,
      editable: true,
      width: '140px',
      cellType: 'text',
      validator: value => (typeof value === 'string' && value.trim().length > 0 ? null : 'Required'),
    },
    {
      id: 'serviceType',
      header: 'Service',
      field: 'serviceType',
      sortable: true,
      filterable: true,
      editable: true,
      width: '140px',
      cellType: 'select',
      selectOptions: SERVICE_TYPE_OPTIONS,
      validator: value => SERVICE_TYPE_OPTIONS.some(opt => opt.value === value) ? null : 'Required',
    },
    {
      id: 'status',
      header: 'Status',
      field: 'status',
      sortable: true,
      filterable: true,
      editable: true,
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
    selectable: true,
    cardViewEnabled: true,
    mobileBreakpoint: 640,
    cardTitleField: 'consumer' as keyof LeadRow,
    cardPreviewFieldCount: 4,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['leads'] as { items: LeadRow[]; total: number } | undefined;
    if (resolved) {
      this.leads.set(resolved.items ?? []);
      this.total.set(resolved.total ?? 0);
      this.loading.set(false);
      this.ignoreNextRequest = true;
    } else {
      this.ignoreNextRequest = false;
      this.loadInitialData();
    }
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
    if (this.ignoreNextRequest) {
      this.ignoreNextRequest = false;
      return;
    }
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

  protected createLead(): void {
    this.router.navigate(['/app/leads/new']);
  }

  protected onLeadDoubleClick(lead: LeadRow): void {
    if (lead.id) {
      this.router.navigate(['/app/leads', lead.id]);
    }
  }

  protected onSaveLeads(rows: LeadRow[]): void {
    rows.forEach(row => {
      // If it's a new row, we need to create it
      // Note: DataGrid component should provide the data in a format we can use
      // or we handle mapping here.
      
      const consumer = (row as Lead).consumer ?? {};
      const address = (row as Lead).address ?? {};

      const normalize = (value?: string | null): string | undefined => {
        const trimmed = value?.trim();
        return trimmed || undefined;
      };

      const normalizePhone = (value?: string | null): string | undefined => {
        const trimmed = value?.trim();
        if (!trimmed) return undefined;
        const parsed = parsePhoneNumberFromString(trimmed, this.phoneRegion);
        if (!parsed?.isValid()) {
          return trimmed;
        }
        return parsed.number;
      };

      if (row.id) {
        // Handle updates
        const updateRequest = {
          firstName: normalize(consumer.firstName),
          lastName: normalize(consumer.lastName),
          phone: normalizePhone(consumer.phone),
          email: normalize(consumer.email ?? undefined),
          consumerRole: consumer.role,
          street: normalize(address.street),
          houseNumber: normalize(address.houseNumber),
          zipCode: normalize(address.zipCode),
          city: normalize(address.city),
          serviceType: row.serviceType,
        };

        this.leadsService.update(row.id, updateRequest).subscribe({
          next: () => this.loadInitialData(),
          error: (err) => this.error.set(err.error?.message || 'Failed to update lead')
        });
      } else {
        // Example mapping for a new lead
        // The grid likely puts nested objects if the field was 'consumer.firstName' etc.
        // Assuming the store.addNewRow() and cell updates maintain the structure.
        const leadRequest: CreateLeadRequest = {
          firstName: consumer.firstName ?? '',
          lastName: consumer.lastName ?? '',
          phone: normalizePhone(consumer.phone) ?? '',
          email: consumer.email,
          consumerRole: consumer.role ?? 'Owner',
          street: address.street ?? '',
          houseNumber: address.houseNumber ?? '',
          zipCode: address.zipCode ?? '',
          city: address.city ?? '',
          serviceType: row.serviceType ?? 'Windows',
        };

        this.leadsService.create(leadRequest).subscribe({
          next: () => this.loadInitialData(),
          error: (err) => this.error.set(err.error?.message || 'Failed to create lead')
        });
      }
    });
  }
}
