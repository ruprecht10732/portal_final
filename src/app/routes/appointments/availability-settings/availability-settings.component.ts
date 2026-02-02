import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { AvailabilityRuleResponse, AvailabilityOverrideResponse, CreateAvailabilityRuleRequest, CreateAvailabilityOverrideRequest } from '../../../core/services/appointments.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

interface WeekdayOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-availability-settings',
  templateUrl: './availability-settings.component.html',
  styleUrl: './availability-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, ConfirmDialogComponent, TranslatePipe, DatePipe],
})
export class AvailabilitySettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  // State
  protected readonly rules = signal<AvailabilityRuleResponse[]>([]);
  protected readonly overrides = signal<AvailabilityOverrideResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showRuleForm = signal(false);
  protected readonly showOverrideForm = signal(false);
  protected readonly editingRuleId = signal<string | null>(null);
  protected readonly editingOverrideId = signal<string | null>(null);
  protected readonly pendingDeleteId = signal<string | null>(null);
  protected readonly pendingDeleteType = signal<'rule' | 'override' | null>(null);
  protected readonly deleteInProgress = signal(false);

  // Forms
  protected ruleForm: FormGroup;
  protected overrideForm: FormGroup;

  protected readonly weekdays = computed<WeekdayOption[]>(() => {
    this.lang();
    return [
      { value: 0, label: this.translate.instant('appointments.availability.weekdays.sunday') },
      { value: 1, label: this.translate.instant('appointments.availability.weekdays.monday') },
      { value: 2, label: this.translate.instant('appointments.availability.weekdays.tuesday') },
      { value: 3, label: this.translate.instant('appointments.availability.weekdays.wednesday') },
      { value: 4, label: this.translate.instant('appointments.availability.weekdays.thursday') },
      { value: 5, label: this.translate.instant('appointments.availability.weekdays.friday') },
      { value: 6, label: this.translate.instant('appointments.availability.weekdays.saturday') },
    ];
  });

  protected readonly sortedRules = computed(() => {
    return [...this.rules()].sort((a, b) => a.weekday - b.weekday);
  });

  protected readonly sortedOverrides = computed(() => {
    return [...this.overrides()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  protected readonly isDeleteDialogOpen = computed(() => !!this.pendingDeleteId());

  constructor() {
    this.ruleForm = this.fb.group({
      weekday: [1, Validators.required],
      startTime: ['09:00', Validators.required],
      endTime: ['17:00', Validators.required],
    });

    this.overrideForm = this.fb.group({
      date: ['', Validators.required],
      isAvailable: [false],
      startTime: ['09:00'],
      endTime: ['17:00'],
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      rules: this.appointmentsService.listAvailabilityRules(),
      overrides: this.appointmentsService.listAvailabilityOverrides(),
    }).subscribe({
      next: (data) => {
        this.rules.set(data.rules);
        this.overrides.set(data.overrides);
        this.loading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.availability.errors.load'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected getWeekdayLabel(weekday: number): string {
    return this.weekdays().find(w => w.value === weekday)?.label ?? String(weekday);
  }

  // Rule form methods
  protected openRuleForm(): void {
    this.editingRuleId.set(null);
    this.ruleForm.reset({ weekday: 1, startTime: '09:00', endTime: '17:00' });
    this.showRuleForm.set(true);
  }

  protected editRule(rule: AvailabilityRuleResponse): void {
    this.editingRuleId.set(rule.id);
    this.ruleForm.patchValue({
      weekday: rule.weekday,
      startTime: rule.startTime,
      endTime: rule.endTime,
    });
    this.showRuleForm.set(true);
  }

  protected closeRuleForm(): void {
    this.showRuleForm.set(false);
    this.editingRuleId.set(null);
  }

  protected saveRule(): void {
    if (this.ruleForm.invalid) return;

    const data: CreateAvailabilityRuleRequest = {
      weekday: this.ruleForm.value.weekday,
      startTime: this.ruleForm.value.startTime,
      endTime: this.ruleForm.value.endTime,
    };

    this.loading.set(true);

    const editingId = this.editingRuleId();
    const request$ = editingId
      ? this.appointmentsService.updateAvailabilityRule(editingId, data)
      : this.appointmentsService.createAvailabilityRule(data);

    request$.subscribe({
      next: () => {
        this.closeRuleForm();
        this.loadData();
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.availability.errors.saveRule'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  // Override form methods
  protected openOverrideForm(): void {
    this.editingOverrideId.set(null);
    const today = new Date().toISOString().split('T')[0];
    this.overrideForm.reset({ date: today, isAvailable: false, startTime: '09:00', endTime: '17:00' });
    this.showOverrideForm.set(true);
  }

  protected editOverride(override: AvailabilityOverrideResponse): void {
    this.editingOverrideId.set(override.id);
    this.overrideForm.patchValue({
      date: override.date,
      isAvailable: override.isAvailable,
      startTime: override.startTime ?? '09:00',
      endTime: override.endTime ?? '17:00',
    });
    this.showOverrideForm.set(true);
  }

  protected closeOverrideForm(): void {
    this.showOverrideForm.set(false);
    this.editingOverrideId.set(null);
  }

  protected get overrideIsAvailable(): boolean {
    return this.overrideForm.get('isAvailable')?.value ?? false;
  }

  protected saveOverride(): void {
    if (this.overrideForm.invalid) return;

    const isAvailable = this.overrideForm.value.isAvailable;
    const data: CreateAvailabilityOverrideRequest = {
      date: this.overrideForm.value.date,
      isAvailable,
      ...(isAvailable && {
        startTime: this.overrideForm.value.startTime,
        endTime: this.overrideForm.value.endTime,
      }),
    };

    this.loading.set(true);

    const editingId = this.editingOverrideId();
    const request$ = editingId
      ? this.appointmentsService.updateAvailabilityOverride(editingId, data)
      : this.appointmentsService.createAvailabilityOverride(data);

    request$.subscribe({
      next: () => {
        this.closeOverrideForm();
        this.loadData();
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.availability.errors.saveOverride'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  // Delete methods
  protected promptDeleteRule(id: string): void {
    this.pendingDeleteId.set(id);
    this.pendingDeleteType.set('rule');
  }

  protected promptDeleteOverride(id: string): void {
    this.pendingDeleteId.set(id);
    this.pendingDeleteType.set('override');
  }

  protected closeDeleteDialog(): void {
    this.pendingDeleteId.set(null);
    this.pendingDeleteType.set(null);
    this.deleteInProgress.set(false);
  }

  protected confirmDelete(): void {
    const id = this.pendingDeleteId();
    const type = this.pendingDeleteType();
    if (!id || !type) return;

    this.deleteInProgress.set(true);

    const request$ = type === 'rule'
      ? this.appointmentsService.deleteAvailabilityRule(id)
      : this.appointmentsService.deleteAvailabilityOverride(id);

    request$.subscribe({
      next: () => {
        this.closeDeleteDialog();
        this.loadData();
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.availability.errors.delete'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleteInProgress.set(false);
      },
    });
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
