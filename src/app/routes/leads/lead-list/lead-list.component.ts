import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, Observable } from 'rxjs';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { LeadsService } from '../../../core/services/leads.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import { UserService } from '../../../core/services/user.service';
import type { Lead, ListLeadsParams, SortField, CreateLeadRequest, UpdateLeadRequest } from '../../../core/services/leads.types';
import { STATUS_LABELS, STATUS_OPTIONS, CONSUMER_ROLE_OPTIONS } from '../../../core/services/leads.types';
import { FabButtonComponent } from '../../../shared/components/fab-button/fab-button.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { GridColumn, GridConfig, DataRequest, DataResponse } from '../../../shared/components/data-grid/data-grid.types';
import { DEFAULT_PHONE_REGION, MIN_LENGTH, DEFAULT_PAGE_SIZE, MOBILE_BREAKPOINT } from '../../../core/config';

type LeadRow = Lead & Record<string, unknown>;

@Component({
  selector: 'app-lead-list',
  templateUrl: './lead-list.component.html',
  styleUrl: './lead-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FabButtonComponent, DataGridComponent, ConfirmDialogComponent],
})
export class LeadListComponent implements OnInit {
  private readonly leadsService = inject(LeadsService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reporter = inject(ErrorReportingService);

  protected readonly leads = signal<LeadRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly userOptions = signal<{ label: string; value: string }[]>([]);
  protected readonly serviceTypes = signal<ServiceTypeItem[]>([]);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly deleteInProgress = signal(false);
  protected readonly pendingDeleteRows = signal<LeadRow[]>([]);
  protected readonly deleteCount = computed(() => this.pendingDeleteRows().length);
  private ignoreNextRequest = true;
  private readonly phoneRegion = DEFAULT_PHONE_REGION;

  private readonly baseColumns: GridColumn<LeadRow>[] = [
    {
      id: 'fullName',
      header: 'Name',
      field: 'fullName',
      sortable: false,
      width: '180px',
      visible: false,
    },
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
        return text.trim().length >= MIN_LENGTH.phone ? null : 'Min 5 chars';
      },
    },
    {
      id: 'email',
      header: 'Email',
      field: 'consumer.email' as keyof LeadRow,
      editable: true,
      width: '200px',
      cellType: 'text',
      validator: value => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value !== 'string') return 'Invalid email';
        return value.includes('@') ? null : 'Invalid email';
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
      cellType: 'address',
      addressMapping: {
        street: 'address.street',
        houseNumber: 'address.houseNumber',
        zipCode: 'address.zipCode',
        city: 'address.city',
      },
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
      editable: false, // Now per-service, edit in detail view
      width: '140px',
      cellType: 'select',
    },
    {
      id: 'status',
      header: 'Status',
      field: 'status',
      sortable: true,
      filterable: true,
      editable: false, // Now per-service, edit in detail view
      width: '140px',
      cellType: 'select',
      selectOptions: STATUS_OPTIONS.map(opt => ({
        label: STATUS_LABELS[opt.value],
        value: opt.value,
      })),
    },
    {
      id: 'assignedAgentId',
      header: 'Assignee',
      field: 'assignedAgentId',
      editable: true,
      width: '180px',
      cellType: 'select',
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

  protected readonly serviceTypeOptions = computed(() =>
    this.serviceTypes().map(item => ({
      label: item.name,
      value: item.name,
    }))
  );

  protected readonly columns = computed<GridColumn<LeadRow>[]>(() => {
    const assigneeOptions = [{ label: 'Unassigned', value: '' }, ...this.userOptions()];
    return this.baseColumns.map(column => {
      if (column.id === 'assignedAgentId') {
        return { ...column, selectOptions: assigneeOptions };
      }
      if (column.id === 'serviceType') {
        return { ...column, selectOptions: this.serviceTypeOptions() };
      }
      return column;
    });
  });

  protected readonly gridConfig: Partial<GridConfig<LeadRow>> = {
    rowIdField: 'id',
    selectable: true,
    cardViewEnabled: true,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    cardTitleField: 'fullName',
    cardSubtitleField: 'consumer.phone',
    cardSecondarySubtitleField: 'consumer.email',
    statusField: 'status',
    cardPreviewFieldCount: 4,
    mobileAddRowEnabled: false,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);

  ngOnInit(): void {
    this.loadUsers();
    this.loadServiceTypes();
    const resolved = this.route.snapshot.data['leads'] as { items: LeadRow[]; total: number } | undefined;
    if (resolved) {
      const normalized = (resolved.items ?? []).map(row => this.normalizeLead(row));
      this.leads.set(normalized);
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
    this.leadsService.list({ page: 1, pageSize: DEFAULT_PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'desc' }).subscribe({
      next: (response) => {
        const normalized = (response.items as LeadRow[]).map(row => this.normalizeLead(row));
        this.leads.set(normalized);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, 'Failed to load leads');
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private loadUsers(): void {
    this.userService.listUsers().subscribe({
      next: (users) => {
        const options = users.map(user => ({
          label: user.roles.length ? `${user.email} (${user.roles.join(', ')})` : user.email,
          value: user.id,
        }));
        this.userOptions.set(options);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, 'Failed to load users');
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadServiceTypes(): void {
    this.serviceTypesService.listActive().subscribe({
      next: (response) => this.serviceTypes.set(response.items ?? []),
      error: (err) => {
        const message = this.getErrorMessage(err, 'Failed to load service types');
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private getDefaultServiceType(): string {
    return this.serviceTypes()[0]?.name ?? '';
  }

  private normalizeLead(row: LeadRow): LeadRow {
    return {
      ...row,
      assignedAgentId: row.assignedAgentId ?? '',
      fullName: `${row.consumer?.firstName ?? ''} ${row.consumer?.lastName ?? ''}`.trim(),
      // Map currentService fields to top level for grid display
      serviceType: row.currentService?.serviceType ?? this.getDefaultServiceType(),
      status: row.currentService?.status ?? 'New',
    } as LeadRow;
  }

  protected fetchData(request: DataRequest): Observable<DataResponse<LeadRow>> {
    const sortFieldMap: Record<string, SortField> = {
      name: 'firstName',
      fullName: 'firstName',
      firstName: 'firstName',
      lastName: 'lastName',
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
        data: (response.items as LeadRow[]).map(row => this.normalizeLead(row)),
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
        const message = this.getErrorMessage(err, 'Failed to load leads');
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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

  protected onDeleteLeads(rows: LeadRow[]): void {
    if (rows.length === 0) return;
    this.pendingDeleteRows.set(rows);
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleteDialogOpen.set(false);
    this.pendingDeleteRows.set([]);
    this.deleteInProgress.set(false);
  }

  protected confirmDelete(): void {
    const rows = this.pendingDeleteRows();
    const ids = rows.map(row => row.id).filter((id): id is string => !!id);
    if (ids.length === 0) {
      this.closeDeleteDialog();
      return;
    }

    this.deleteInProgress.set(true);
    this.leadsService.bulkDelete(ids).subscribe({
      next: () => {
        this.closeDeleteDialog();
        this.loadInitialData();
      },
      error: (err) => {
        const message = this.getErrorMessage(err, 'Failed to delete leads');
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleteInProgress.set(false);
      },
    });
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

      const assigneeId = row.assignedAgentId;
      const normalizedAssigneeId = assigneeId === '' || assigneeId === 'null' ? null : assigneeId;

      if (row.id) {
        // Handle updates - note: serviceType and status are now per-service, not on lead level
        const updateRequest: UpdateLeadRequest = {
          firstName: normalize(consumer.firstName),
          lastName: normalize(consumer.lastName),
          phone: normalizePhone(consumer.phone),
          email: normalize(consumer.email ?? undefined),
          consumerRole: consumer.role,
          street: normalize(address.street),
          houseNumber: normalize(address.houseNumber),
          zipCode: normalize(address.zipCode),
          city: normalize(address.city),
          assigneeId: normalizedAssigneeId,
        };

        this.leadsService.update(row.id, updateRequest).subscribe({
          next: () => this.loadInitialData(),
          error: (err) => {
            const message = this.getErrorMessage(err, 'Failed to update lead');
            this.error.set(message);
            this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          },
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
          serviceType: (row['serviceType'] as string | undefined) ?? row.currentService?.serviceType ?? this.getDefaultServiceType(),
          assigneeId: normalizedAssigneeId,
        };

        this.leadsService.create(leadRequest).subscribe({
          next: () => this.loadInitialData(),
          error: (err) => {
            const message = this.getErrorMessage(err, 'Failed to create lead');
            this.error.set(message);
            this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          }
        });
      }
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return this.extractMessage(error) ?? fallback;
  }

  private extractMessage(error: unknown): string | null {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (!error || typeof error !== 'object') {
      return null;
    }

    const directMessage = (error as { message?: unknown }).message;
    if (typeof directMessage === 'string' && directMessage) {
      return directMessage;
    }

    const nested = (error as { error?: unknown }).error;
    if (typeof nested === 'string' && nested) {
      return nested;
    }
    if (nested && typeof nested === 'object') {
      const nestedError = (nested as { error?: unknown }).error;
      if (typeof nestedError === 'string' && nestedError) {
        return nestedError;
      }
      const nestedMessage = (nested as { message?: unknown }).message;
      if (typeof nestedMessage === 'string' && nestedMessage) {
        return nestedMessage;
      }
    }

    return null;
  }
}
