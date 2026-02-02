import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-appointment-detail',
  templateUrl: './appointment-detail.component.html',
  styleUrl: './appointment-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, ConfirmDialogComponent, TranslatePipe, DatePipe],
})
export class AppointmentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
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

  protected appointmentForm: FormGroup;
  protected visitReportForm: FormGroup;

  protected readonly statusOptions: { value: AppointmentStatus; label: string }[] = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
  ];

  protected readonly accessDifficultyOptions = ACCESS_DIFFICULTY_OPTIONS;

  constructor() {
    this.appointmentForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      location: [''],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      allDay: [false],
    });

    this.visitReportForm = this.fb.group({
      measurements: [''],
      accessDifficulty: [''],
      notes: [''],
    });
  }

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
        this.populateForm(data.appointment);
        if (data.visitReport) {
          this.populateVisitReportForm(data.visitReport);
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

  private populateForm(apt: AppointmentResponse): void {
    const startDate = new Date(apt.startTime);
    const endDate = new Date(apt.endTime);
    
    this.appointmentForm.patchValue({
      title: apt.title,
      description: apt.description ?? '',
      location: apt.location ?? '',
      startTime: this.formatDateTimeLocal(startDate),
      endTime: this.formatDateTimeLocal(endDate),
      allDay: apt.allDay,
    });
  }

  private populateVisitReportForm(report: AppointmentVisitReportResponse): void {
    this.visitReportForm.patchValue({
      measurements: report.measurements ?? '',
      accessDifficulty: report.accessDifficulty ?? '',
      notes: report.notes ?? '',
    });
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
        this.populateForm(apt);
      }
    }
  }

  protected toggleVisitReport(): void {
    this.showVisitReport.update(v => !v);
  }

  protected saveAppointment(): void {
    if (this.appointmentForm.invalid) return;
    const apt = this.appointment();
    if (!apt) return;

    this.saving.set(true);

    const data: UpdateAppointmentRequest = {
      title: this.appointmentForm.value.title,
      description: this.appointmentForm.value.description || undefined,
      location: this.appointmentForm.value.location || undefined,
      startTime: new Date(this.appointmentForm.value.startTime).toISOString(),
      endTime: new Date(this.appointmentForm.value.endTime).toISOString(),
      allDay: this.appointmentForm.value.allDay,
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
      measurements: this.visitReportForm.value.measurements || undefined,
      accessDifficulty: this.visitReportForm.value.accessDifficulty as AccessDifficulty || undefined,
      notes: this.visitReportForm.value.notes || undefined,
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
