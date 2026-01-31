import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, Observable } from 'rxjs';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { LeadsService } from '../../../core/services/leads.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import { UserService } from '../../../core/services/user.service';
import type { Lead, LeadStatus, ListLeadsParams, SortField, CreateLeadRequest, UpdateLeadRequest } from '../../../core/services/leads.types';
import { STATUS_OPTIONS, CONSUMER_ROLE_OPTIONS } from '../../../core/services/leads.types';
import { FabButtonComponent } from '../../../shared/components/fab-button/fab-button.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { GridColumn, GridConfig, DataRequest, DataResponse } from '../../../shared/components/data-grid/data-grid.types';
import { DEFAULT_PHONE_REGION, MIN_LENGTH, DEFAULT_PAGE_SIZE, MOBILE_BREAKPOINT } from '../../../core/config';
import type { LeadsListResolved } from '../leads-list.resolver';
import type { UserSummary } from '../../../core/services/user.types';

type LeadRow = Lead & Record<string, unknown>;

@Component({
  selector: 'app-lead-list',
  templateUrl: './lead-list.component.html',
  styleUrl: './lead-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FabButtonComponent, DataGridComponent, ConfirmDialogComponent, TranslatePipe],
})
export class LeadListComponent implements OnInit {
  private readonly leadsService = inject(LeadsService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

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

  protected readonly statusLabels = computed<Record<LeadStatus, string>>(() => {
    this.lang();
    return {
      New: this.translate.instant('leads.detail.status.new'),
      Attempted_Contact: this.translate.instant('leads.detail.status.contacted'),
      Scheduled: this.translate.instant('leads.detail.status.scheduled'),
      Surveyed: this.translate.instant('leads.detail.status.completed'),
      Bad_Lead: this.translate.instant('leads.detail.status.badLead'),
      Needs_Rescheduling: this.translate.instant('leads.detail.status.needsRescheduling'),
      Closed: this.translate.instant('leads.detail.status.closed'),
    };
  });

  protected readonly consumerRoleOptions = computed(() => {
    this.lang();
    return CONSUMER_ROLE_OPTIONS.map(option => ({
      value: option.value,
      label: this.translate.instant(`leads.list.roles.${option.value.toLowerCase()}`),
    }));
  });

  private readonly baseColumns = computed<GridColumn<LeadRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'fullName',
        header: this.translate.instant('leads.list.columns.name'),
        field: 'fullName',
        sortable: false,
        width: '180px',
        visible: false,
      },
      {
        id: 'firstName',
        header: this.translate.instant('leads.list.columns.firstName'),
        field: 'consumer.firstName' as keyof LeadRow,
        sortable: true,
        editable: true,
        width: '140px',
        cellType: 'text',
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('leads.list.validation.required')),
      },
      {
        id: 'lastName',
        header: this.translate.instant('leads.list.columns.lastName'),
        field: 'consumer.lastName' as keyof LeadRow,
        sortable: true,
        editable: true,
        width: '140px',
        cellType: 'text',
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('leads.list.validation.required')),
      },
      {
        id: 'phone',
        header: this.translate.instant('leads.list.columns.phone'),
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
          return text.trim().length >= MIN_LENGTH.phone
            ? null
            : this.translate.instant('leads.list.validation.minChars', { count: MIN_LENGTH.phone });
        },
      },
      {
        id: 'email',
        header: this.translate.instant('leads.list.columns.email'),
        field: 'consumer.email' as keyof LeadRow,
        editable: true,
        width: '200px',
        cellType: 'text',
        validator: value => {
          if (value === null || value === undefined || value === '') return null;
          if (typeof value !== 'string') return this.translate.instant('leads.list.validation.invalidEmail');
          return value.includes('@') ? null : this.translate.instant('leads.list.validation.invalidEmail');
        },
      },
      {
        id: 'role',
        header: this.translate.instant('leads.list.columns.role'),
        field: 'consumer.role' as keyof LeadRow,
        editable: true,
        width: '120px',
        cellType: 'select',
        selectOptions: this.consumerRoleOptions(),
        validator: value => this.consumerRoleOptions().some(opt => opt.value === value)
          ? null
          : this.translate.instant('leads.list.validation.required'),
      },
      {
        id: 'street',
        header: this.translate.instant('leads.list.columns.street'),
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
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('leads.list.validation.required')),
      },
      {
        id: 'houseNumber',
        header: this.translate.instant('leads.list.columns.houseNumber'),
        field: 'address.houseNumber' as keyof LeadRow,
        editable: true,
        width: '110px',
        cellType: 'text',
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('leads.list.validation.required')),
      },
      {
        id: 'zipCode',
        header: this.translate.instant('leads.list.columns.zipCode'),
        field: 'address.zipCode' as keyof LeadRow,
        editable: true,
        width: '110px',
        cellType: 'text',
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('leads.list.validation.required')),
      },
      {
        id: 'city',
        header: this.translate.instant('leads.list.columns.city'),
        field: 'address.city' as keyof LeadRow,
        editable: true,
        width: '140px',
        cellType: 'text',
        validator: value => (typeof value === 'string' && value.trim().length > 0
          ? null
          : this.translate.instant('leads.list.validation.required')),
      },
      {
        id: 'serviceType',
        header: this.translate.instant('leads.list.columns.serviceType'),
        field: 'serviceType',
        sortable: true,
        filterable: true,
        editable: true,
        editableWhen: 'new-only',
        width: '140px',
        cellType: 'select',
      },
      {
        id: 'status',
        header: this.translate.instant('leads.list.columns.status'),
        field: 'status',
        sortable: true,
        filterable: true,
        editable: true,
        editableWhen: 'new-only',
        width: '140px',
        cellType: 'select',
        selectOptions: STATUS_OPTIONS.map(opt => ({
          label: this.statusLabels()[opt.value],
          value: opt.value,
        })),
      },
      {
        id: 'assignedAgentId',
        header: this.translate.instant('leads.list.columns.assignee'),
        field: 'assignedAgentId',
        editable: true,
        width: '180px',
        cellType: 'select',
      },
      {
        id: 'createdAt',
        header: this.translate.instant('leads.list.columns.createdAt'),
        field: 'createdAt',
        sortable: true,
        width: '110px',
        cellType: 'date',
      },
    ];
  });

  protected readonly serviceTypeOptions = computed(() =>
    this.serviceTypes().map(item => ({
      label: item.name,
      value: item.name,
    }))
  );

  protected readonly serviceTypeMetaOptions = computed(() =>
    this.serviceTypes().map(item => ({
      label: item.name,
      value: item.name,
      icon: item.icon ?? null,
      color: item.color ?? null,
      description: item.description ?? null,
    }))
  );

  protected readonly columns = computed<GridColumn<LeadRow>[]>(() => {
    const assigneeOptions = [{ label: this.translate.instant('leads.list.unassigned'), value: '' }, ...this.userOptions()];
    return this.baseColumns().map(column => {
      if (column.id === 'assignedAgentId') {
        return { ...column, selectOptions: assigneeOptions };
      }
      if (column.id === 'serviceType') {
        return { ...column, selectOptions: this.serviceTypeOptions(), metaOptions: this.serviceTypeMetaOptions() };
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
    rowViewActionEnabled: true,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['leads'] as LeadsListResolved | undefined;
    if (resolved) {
      const resolvedUsers = resolved.users ?? [];
      const resolvedServiceTypes = resolved.serviceTypes ?? [];
      this.userOptions.set(resolvedUsers.map(user => ({
		label: this.formatUserLabel(user),
        value: user.id,
      })));
      this.serviceTypes.set(resolvedServiceTypes);

      const normalized = (resolved.leads?.items ?? []).map(row => this.normalizeLead(row));
      this.leads.set(normalized);
      this.total.set(resolved.leads?.total ?? 0);
      this.loading.set(false);
      this.ignoreNextRequest = true;
    } else {
      this.ignoreNextRequest = false;
      this.loadUsers();
      this.loadServiceTypes();
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
        const message = this.getErrorMessage(err, this.translate.instant('leads.list.errors.loadLeads'));
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
			label: this.formatUserLabel(user),
          value: user.id,
        }));
        this.userOptions.set(options);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.list.errors.loadUsers'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadServiceTypes(): void {
    this.serviceTypesService.listActive().subscribe({
      next: (response) => this.serviceTypes.set(response.items ?? []),
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.list.errors.loadServiceTypes'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private getDefaultServiceType(): string {
    return this.serviceTypes()[0]?.name ?? '';
  }

  private formatUserLabel(user: UserSummary): string {
    const first = (user.firstName ?? '').trim();
    const last = (user.lastName ?? '').trim();
    const fullName = `${first} ${last}`.trim();
    const base = fullName || user.email;
    return user.roles.length ? `${base} (${user.roles.join(', ')})` : base;
  }

  private normalizeLead(row: Lead): LeadRow {
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

        const requestedStatus = (row['status'] as LeadStatus | undefined) ?? row.currentService?.status;

        this.leadsService.create(leadRequest).subscribe({
          next: (created) => {
            const currentServiceId = created.currentService?.id;
            if (requestedStatus && requestedStatus !== 'New' && currentServiceId) {
              this.leadsService.updateServiceStatus(created.id, currentServiceId, { status: requestedStatus }).subscribe({
                next: () => this.loadInitialData(),
                error: (err) => {
                  const message = this.getErrorMessage(err, 'Failed to set lead status');
                  this.error.set(message);
                  this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
                  this.loadInitialData();
                },
              });
            } else {
              this.loadInitialData();
            }
          },
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
