import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { 
  AppointmentResponse, 
  AppointmentVisitReportResponse, 
  AppointmentStatus,
  UpdateAppointmentRequest,
  UpsertVisitReportRequest,
  AccessDifficulty,
} from '../../../core/services/appointments.types';
import { ACCESS_DIFFICULTY_OPTIONS } from '../../../core/services/appointments.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CardComponent } from '../../../shared/components/card/card.component';

@Component({
  selector: 'app-appointment-detail',
  templateUrl: './appointment-detail.component.html',
  styleUrl: './appointment-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, InputComponent, TextareaComponent, SelectComponent, CheckboxComponent, CardComponent, ConfirmDialogComponent, LucideAngularModule, TranslatePipe, DatePipe],
})
export class AppointmentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);

  protected readonly appointment = signal<AppointmentResponse | null>(null);
  protected readonly visitReport = signal<AppointmentVisitReportResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isEditing = signal(false);
  protected readonly showVisitReport = signal(false);
  protected readonly showDeleteDialog = signal(false);
  protected readonly deleteInProgress = signal(false);

  // Edit form signals
  protected readonly editTitle = signal('');
  protected readonly editDescription = signal('');
  protected readonly editLocation = signal('');
  protected readonly editStartTime = signal('');
  protected readonly editEndTime = signal('');
  protected readonly editAllDay = signal(false);

  // Visit report form signals
  protected readonly reportMeasurements = signal('');
  protected readonly reportAccessDifficulty = signal<AccessDifficulty | ''>('');
  protected readonly reportNotes = signal('');

  protected readonly statusOptions: SelectOption<AppointmentStatus>[] = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
  ];

  protected readonly accessDifficultySelectOptions = computed<SelectOption<AccessDifficulty>[]>(() => 
    ACCESS_DIFFICULTY_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))
  );

  protected readonly canSaveEdit = computed(() => {
    return this.editTitle().trim() !== '' && this.editStartTime() !== '' && this.editEndTime() !== '';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAppointment(id);
    }
  }

  private loadAppointment(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      appointment: this.appointmentsService.getById(id),
      visitReport: this.appointmentsService.getVisitReport(id).pipe(
        catchError(() => of(null))
      ),
    }).subscribe({
      next: (data) => {
        this.appointment.set(data.appointment);
        this.visitReport.set(data.visitReport);
        this.populateEditForm(data.appointment);
        if (data.visitReport) {
          this.populateReportForm(data.visitReport);
        }
        this.loading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.detail.errors.load'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private populateEditForm(apt: AppointmentResponse): void {
    const startDate = new Date(apt.startTime);
    const endDate = new Date(apt.endTime);
    
    this.editTitle.set(apt.title);
    this.editDescription.set(apt.description ?? '');
    this.editLocation.set(apt.location ?? '');
    this.editStartTime.set(this.formatDateTimeLocal(startDate));
    this.editEndTime.set(this.formatDateTimeLocal(endDate));
    this.editAllDay.set(apt.allDay);
  }

  private populateReportForm(report: AppointmentVisitReportResponse): void {
    this.reportMeasurements.set(report.measurements ?? '');
    this.reportAccessDifficulty.set(report.accessDifficulty ?? '');
    this.reportNotes.set(report.notes ?? '');
  }

  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  protected toggleEdit(): void {
    this.isEditing.update(v => !v);
    if (!this.isEditing()) {
      const apt = this.appointment();
      if (apt) {
        this.populateEditForm(apt);
      }
    }
  }

  protected toggleVisitReport(): void {
    this.showVisitReport.update(v => !v);
  }

  protected saveAppointment(): void {
    if (!this.canSaveEdit()) return;
    const apt = this.appointment();
    if (!apt) return;

    this.saving.set(true);

    const data: UpdateAppointmentRequest = {
      title: this.editTitle(),
      description: this.editDescription() || undefined,
      location: this.editLocation() || undefined,
      startTime: new Date(this.editStartTime()).toISOString(),
      endTime: new Date(this.editEndTime()).toISOString(),
      allDay: this.editAllDay(),
    };

    this.appointmentsService.update(apt.id, data).subscribe({
      next: (updated) => {
        this.appointment.set(updated);
        this.isEditing.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.detail.errors.save'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected saveVisitReport(): void {
    const apt = this.appointment();
    if (!apt) return;

    this.saving.set(true);

    const data: UpsertVisitReportRequest = {
      measurements: this.reportMeasurements() || undefined,
      accessDifficulty: (this.reportAccessDifficulty() as AccessDifficulty) || undefined,
      notes: this.reportNotes() || undefined,
    };

    this.appointmentsService.upsertVisitReport(apt.id, data).subscribe({
      next: (report) => {
        this.visitReport.set(report);
        this.saving.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.detail.errors.saveReport'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected updateStatus(status: AppointmentStatus): void {
    const apt = this.appointment();
    if (!apt || apt.status === status) return;

    this.saving.set(true);

    this.appointmentsService.updateStatus(apt.id, { status }).subscribe({
      next: (updated) => {
        this.appointment.set(updated);
        this.saving.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.detail.errors.updateStatus'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected promptDelete(): void {
    this.showDeleteDialog.set(true);
  }

  protected closeDeleteDialog(): void {
    this.showDeleteDialog.set(false);
    this.deleteInProgress.set(false);
  }

  protected confirmDelete(): void {
    const apt = this.appointment();
    if (!apt) return;

    this.deleteInProgress.set(true);

    this.appointmentsService.delete(apt.id).subscribe({
      next: () => {
        this.closeDeleteDialog();
        this.router.navigate(['/app/appointments']);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.detail.errors.delete'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleteInProgress.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/appointments']);
  }

  protected getStatusLabel(status: AppointmentStatus): string {
    return this.statusOptions.find(o => o.value === status)?.label ?? status;
  }

  protected getStatusClass(status: AppointmentStatus): string {
    const map: Record<AppointmentStatus, string> = {
      scheduled: 'status-scheduled',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      no_show: 'status-no-show',
    };
    return map[status] ?? '';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      if (typeof e['message'] === 'string') return e['message'];
      if (e['error'] && typeof e['error'] === 'object') {
        const nested = e['error'] as Record<string, unknown>;
        if (typeof nested['message'] === 'string') return nested['message'];
      }
    }
    return fallback;
  }
}
