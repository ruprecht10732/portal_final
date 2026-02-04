import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, debounceTime, distinctUntilChanged, filter, forkJoin, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { AddressService, type AddressSuggestion } from '../../../core/services/address.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
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
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { DEBOUNCE_MS, MIN_LENGTH } from '../../../core/config';

@Component({
  selector: 'app-appointment-detail',
  templateUrl: './appointment-detail.component.html',
  styleUrl: './appointment-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, InputComponent, TextareaComponent, SelectComponent, CheckboxComponent, CardComponent, ConfirmDialogComponent, AutocompleteComponent, LucideAngularModule, TranslatePipe, DatePipe],
})
export class AppointmentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly addressService = inject(AddressService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

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
  protected readonly editMeetingLink = signal('');
  protected readonly editLocationOptions = signal<AutocompleteOption[]>([]);
  private readonly editLocationSuggestions = signal<AddressSuggestion[]>([]);
  private readonly hasEditLocationInput = signal(false);
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

  constructor() {
    this.setupEditLocationSearch();
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
        this.populateEditForm(data.appointment);
        if (data.visitReport) {
          this.populateReportForm(data.visitReport);
        }
        this.loading.set(false);
      },
      error: (err) => {
                const message = extractErrorMessage(err, this.translate.instant('appointments.detail.errors.load'), {
                  allowErrorMessage: true,
                  allowMessageField: true,
                });
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
    this.editMeetingLink.set(apt.meetingLink ?? '');
    this.editStartTime.set(this.formatDateTimeLocal(startDate));
    this.editEndTime.set(this.formatDateTimeLocal(endDate));
    this.editAllDay.set(apt.allDay);
    this.hasEditLocationInput.set(false);
    this.editLocationOptions.set([]);
    this.editLocationSuggestions.set([]);
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

    const description = this.editDescription();
    const location = this.editLocation();
    const meetingLink = this.editMeetingLink().trim();

    const data: UpdateAppointmentRequest = {
      title: this.editTitle(),
      startTime: new Date(this.editStartTime()).toISOString(),
      endTime: new Date(this.editEndTime()).toISOString(),
      allDay: this.editAllDay(),
      ...(description && { description }),
      ...(location && { location }),
      ...(meetingLink && { meetingLink }),
    };

    this.appointmentsService.update(apt.id, data).subscribe({
      next: (updated) => {
        this.appointment.set(updated);
        this.isEditing.set(false);
        this.saving.set(false);
      },
      error: (err) => {
                const message = extractErrorMessage(err, this.translate.instant('appointments.detail.errors.save'), {
                  allowErrorMessage: true,
                  allowMessageField: true,
                });
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected onEditLocationChange(value: string): void {
    this.hasEditLocationInput.set(true);
    this.editLocation.set(value);

    const match = this.editLocationSuggestions().find(suggestion => suggestion.label === value);
    if (match) {
      this.editLocation.set(match.label);
      this.hasEditLocationInput.set(false);
      this.editLocationOptions.set([]);
      this.editLocationSuggestions.set([]);
    }
  }

  private setupEditLocationSearch(): void {
    effect(() => {
      if (this.editLocation().trim().length < MIN_LENGTH.address) {
        this.editLocationOptions.set([]);
        this.editLocationSuggestions.set([]);
      }
    });

    toObservable(this.editLocation)
      .pipe(
        map(value => value.trim()),
        filter(() => this.hasEditLocationInput()),
        filter(value => value.length >= MIN_LENGTH.address),
        debounceTime(DEBOUNCE_MS.search),
        distinctUntilChanged(),
        switchMap(query => this.addressService.search(query).pipe(
          catchError(() => of([]))
        )),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(results => {
        this.editLocationSuggestions.set(results);
        this.editLocationOptions.set(results.map(addr => ({
          label: addr.label,
          value: addr.label,
        })));
      });
  }

  protected saveVisitReport(): void {
    const apt = this.appointment();
    if (!apt) return;

    this.saving.set(true);

    const measurements = this.reportMeasurements();
    const accessDifficulty = this.reportAccessDifficulty() as AccessDifficulty;
    const notes = this.reportNotes();

    const data: UpsertVisitReportRequest = {
      ...(measurements && { measurements }),
      ...(accessDifficulty && { accessDifficulty }),
      ...(notes && { notes }),
    };

    this.appointmentsService.upsertVisitReport(apt.id, data).subscribe({
      next: (report) => {
        this.visitReport.set(report);
        this.saving.set(false);
      },
      error: (err) => {
                const message = extractErrorMessage(err, this.translate.instant('appointments.detail.errors.saveReport'), {
                  allowErrorMessage: true,
                  allowMessageField: true,
                });
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
                const message = extractErrorMessage(err, this.translate.instant('appointments.detail.errors.updateStatus'), {
                  allowErrorMessage: true,
                  allowMessageField: true,
                });
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
                const message = extractErrorMessage(err, this.translate.instant('appointments.detail.errors.delete'), {
                  allowErrorMessage: true,
                  allowMessageField: true,
                });
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

}
