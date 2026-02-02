import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { CreateAppointmentRequest, AppointmentType } from '../../../core/services/appointments.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-appointment-form',
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, TranslatePipe],
})
export class AppointmentFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected appointmentForm: FormGroup;

  protected readonly typeOptions: { value: AppointmentType; label: string }[] = [
    { value: 'standalone', label: 'Standalone' },
    { value: 'blocked', label: 'Blocked Time' },
  ];

  constructor() {
    this.appointmentForm = this.fb.group({
      type: ['standalone', Validators.required],
      title: ['', Validators.required],
      description: [''],
      location: [''],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      allDay: [false],
      sendConfirmationEmail: [false],
    });
  }

  ngOnInit(): void {
    // Pre-fill from query params if provided (from calendar slot click)
    const queryParams = this.route.snapshot.queryParams;
    if (queryParams['date']) {
      const date = queryParams['date'];
      const time = queryParams['time'] ? Number.parseInt(queryParams['time'], 10) : 9 * 60;
      
      const startDate = new Date(date);
      startDate.setHours(Math.floor(time / 60), time % 60, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + 60); // Default 1 hour duration

      this.appointmentForm.patchValue({
        startTime: this.formatDateTimeLocal(startDate),
        endTime: this.formatDateTimeLocal(endDate),
      });
    } else {
      // Default to current date/time
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const end = new Date(now);
      end.setHours(end.getHours() + 1);

      this.appointmentForm.patchValue({
        startTime: this.formatDateTimeLocal(now),
        endTime: this.formatDateTimeLocal(end),
      });
    }
  }

  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  protected createAppointment(): void {
    if (this.appointmentForm.invalid) return;

    this.saving.set(true);
    this.error.set(null);

    const formValue = this.appointmentForm.value;
    const data: CreateAppointmentRequest = {
      type: formValue.type,
      title: formValue.title,
      description: formValue.description || undefined,
      location: formValue.location || undefined,
      startTime: new Date(formValue.startTime).toISOString(),
      endTime: new Date(formValue.endTime).toISOString(),
      allDay: formValue.allDay,
      sendConfirmationEmail: formValue.sendConfirmationEmail,
    };

    this.appointmentsService.create(data).subscribe({
      next: (created) => {
        this.router.navigate(['/app/appointments', created.id]);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.form.errors.create'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/appointments']);
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
