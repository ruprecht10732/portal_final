import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, map, Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { AppointmentResponse, AppointmentStatus, AppointmentType, ListAppointmentsParams } from '../../../core/services/appointments.types';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { FabButtonComponent } from '../../../shared/components/fab-button/fab-button.component';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import type { GridColumn, GridConfig, DataRequest, DataResponse } from '../../../shared/components/data-grid/data-grid.types';
import { DEFAULT_PAGE_SIZE, MOBILE_BREAKPOINT } from '../../../core/config';

type AppointmentRow = AppointmentResponse & Record<string, unknown>;

@Component({
  selector: 'app-appointments-list',
  templateUrl: './appointments-list.component.html',
  styleUrl: './appointments-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FabButtonComponent, DataGridComponent, ConfirmDialogComponent, PageLayoutComponent, TranslatePipe],
})
export class AppointmentsListComponent implements OnInit {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly appointments = signal<AppointmentRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly deleteInProgress = signal(false);
  protected readonly pendingDeleteRows = signal<AppointmentRow[]>([]);
  protected readonly deleteCount = computed(() => this.pendingDeleteRows().length);
  private ignoreNextRequest = false;

  protected readonly typeLabels = computed<Record<AppointmentType, string>>(() => {
    this.lang();
    return {
      lead_visit: this.translate.instant('appointments.type.leadVisit'),
      standalone: this.translate.instant('appointments.type.standalone'),
      blocked: this.translate.instant('appointments.type.blocked'),
    };
  });

  protected readonly statusLabels = computed<Record<AppointmentStatus, string>>(() => {
    this.lang();
    return {
      scheduled: this.translate.instant('appointments.status.scheduled'),
      requested: this.translate.instant('appointments.status.requested'),
      completed: this.translate.instant('appointments.status.completed'),
      cancelled: this.translate.instant('appointments.status.cancelled'),
      no_show: this.translate.instant('appointments.status.noShow'),
    };
  });

  protected readonly typeOptions = computed(() => [
    { label: this.typeLabels()['lead_visit'], value: 'lead_visit' },
    { label: this.typeLabels()['standalone'], value: 'standalone' },
    { label: this.typeLabels()['blocked'], value: 'blocked' },
  ]);

  protected readonly statusOptions = computed(() => [
    { label: this.statusLabels()['scheduled'], value: 'scheduled' },
    { label: this.statusLabels()['requested'], value: 'requested' },
    { label: this.statusLabels()['completed'], value: 'completed' },
    { label: this.statusLabels()['cancelled'], value: 'cancelled' },
    { label: this.statusLabels()['no_show'], value: 'no_show' },
  ]);

  protected readonly columns = computed<GridColumn<AppointmentRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'title',
        header: this.translate.instant('appointments.list.columns.title'),
        field: 'title',
        sortable: true,
        filterable: false,
        width: '200px',
        cellType: 'text',
      },
      {
        id: 'type',
        header: this.translate.instant('appointments.list.columns.type'),
        field: 'type',
        sortable: true,
        filterable: true,
        width: '120px',
        cellType: 'select',
        selectOptions: this.typeOptions(),
        formatter: (value: unknown) => this.typeLabels()[value as AppointmentType] ?? String(value),
      },
      {
        id: 'status',
        header: this.translate.instant('appointments.list.columns.status'),
        field: 'status',
        sortable: true,
        filterable: true,
        width: '120px',
        cellType: 'select',
        selectOptions: this.statusOptions(),
        formatter: (value: unknown) => this.statusLabels()[value as AppointmentStatus] ?? String(value),
      },
      {
        id: 'startTime',
        header: this.translate.instant('appointments.list.columns.startTime'),
        field: 'startTime',
        sortable: true,
        filterable: false,
        width: '160px',
        cellType: 'date',
      },
      {
        id: 'endTime',
        header: this.translate.instant('appointments.list.columns.endTime'),
        field: 'endTime',
        sortable: true,
        width: '160px',
        cellType: 'date',
      },
      {
        id: 'location',
        header: this.translate.instant('appointments.list.columns.location'),
        field: 'location',
        sortable: false,
        filterable: false,
        width: '180px',
        cellType: 'text',
      },
      {
        id: 'leadName',
        header: this.translate.instant('appointments.list.columns.lead'),
        field: 'leadName' as keyof AppointmentRow,
        sortable: false,
        width: '160px',
        cellType: 'text',
      },
      {
        id: 'createdAt',
        header: this.translate.instant('appointments.list.columns.createdAt'),
        field: 'createdAt',
        sortable: true,
        width: '120px',
        cellType: 'date',
      },
    ];
  });

  protected readonly gridConfig: Partial<GridConfig<AppointmentRow>> = {
    rowIdField: 'id',
    selectable: true,
    cardViewEnabled: true,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    cardTitleField: 'title',
    cardSubtitleField: 'startTime',
    cardSecondarySubtitleField: 'location',
    statusField: 'status',
    cardPreviewFieldCount: 4,
    mobileAddRowEnabled: false,
    rowViewActionEnabled: true,
    rowDeleteActionEnabled: true,
  };

  protected readonly fetchDataFn = this.fetchData.bind(this);

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.appointmentsService.list({ page: 1, pageSize: DEFAULT_PAGE_SIZE }).subscribe({
      next: (response) => {
        const normalized = response.items.map(row => this.normalizeAppointment(row));
        this.appointments.set(normalized);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('appointments.list.errors.loadAppointments'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private normalizeAppointment(apt: AppointmentResponse): AppointmentRow {
    const leadName = apt.lead ? `${apt.lead.firstName} ${apt.lead.lastName}`.trim() : '';
    return {
      ...apt,
      leadName,
    } as AppointmentRow;
  }

  protected fetchData(request: DataRequest): Observable<DataResponse<AppointmentRow>> {
    const params: ListAppointmentsParams = {
      page: request.page,
      pageSize: request.pageSize,
      ...(request.searchTerm && { search: request.searchTerm }),
      ...(request.sort?.columnId && { sortBy: request.sort.columnId }),
      ...(request.sort?.direction && { sortOrder: request.sort.direction }),
    };

    // Map filters
    for (const filter of request.filters) {
      switch (filter.columnId) {
        case 'type':
          params.type = filter.value as AppointmentType;
          break;
        case 'status':
          params.status = filter.value as AppointmentStatus;
          break;
        default:
          break;
      }
    }

    return this.appointmentsService.list(params).pipe(
      map(response => ({
        data: response.items.map(row => this.normalizeAppointment(row)),
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
        this.appointments.set(response.data);
        this.total.set(response.totalItems);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('appointments.list.errors.loadAppointments'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected createAppointment(): void {
    this.router.navigate(['/app/appointments/new']);
  }

  protected onAppointmentDoubleClick(apt: AppointmentRow): void {
    if (apt.id) {
      this.router.navigate(['/app/appointments', apt.id]);
    }
  }

  protected onDeleteAppointments(rows: AppointmentRow[]): void {
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
    if (rows.length === 0) {
      this.closeDeleteDialog();
      return;
    }

    this.deleteInProgress.set(true);
    
    // Delete sequentially since bulk delete may not be supported
    const deletePromises = rows.map(row => 
      firstValueFrom(this.appointmentsService.delete(row.id))
    );

    Promise.all(deletePromises)
      .then(() => {
        this.closeDeleteDialog();
        this.loadInitialData();
      })
      .catch((err) => {
        const message = extractErrorMessage(err, this.translate.instant('appointments.list.errors.deleteAppointments'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleteInProgress.set(false);
      });
  }

}
