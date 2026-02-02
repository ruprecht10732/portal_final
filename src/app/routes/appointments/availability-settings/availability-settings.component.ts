import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin } from 'rxjs';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { AvailabilityRuleResponse, AvailabilityOverrideResponse, CreateAvailabilityRuleRequest, CreateAvailabilityOverrideRequest } from '../../../core/services/appointments.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CardComponent } from '../../../shared/components/card/card.component';

interface WeekdayOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-availability-settings',
  templateUrl: './availability-settings.component.html',
  styleUrl: './availability-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, InputComponent, SelectComponent, CheckboxComponent, CardComponent, ConfirmDialogComponent, LucideAngularModule, TranslatePipe, DatePipe],
})
export class AvailabilitySettingsComponent implements OnInit {
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

  // Rule form signals
  protected readonly ruleWeekday = signal<string>('1');
  protected readonly ruleStartTime = signal('09:00');
  protected readonly ruleEndTime = signal('17:00');

  // Override form signals
  protected readonly overrideDate = signal('');
  protected readonly overrideIsAvailable = signal(false);
  protected readonly overrideStartTime = signal('09:00');
  protected readonly overrideEndTime = signal('17:00');

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

  protected readonly weekdaySelectOptions = computed<SelectOption<string>[]>(() =>
    this.weekdays().map(w => ({ value: String(w.value), label: w.label }))
  );

  protected readonly sortedRules = computed(() => {
    return [...this.rules()].sort((a, b) => a.weekday - b.weekday);
  });

  protected readonly sortedOverrides = computed(() => {
    return [...this.overrides()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  protected readonly isDeleteDialogOpen = computed(() => !!this.pendingDeleteId());

  protected readonly canSaveRule = computed(() =>
    this.ruleWeekday() !== '' && this.ruleStartTime() !== '' && this.ruleEndTime() !== ''
  );

  protected readonly canSaveOverride = computed(() => this.overrideDate() !== '');

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
    this.ruleWeekday.set('1');
    this.ruleStartTime.set('09:00');
    this.ruleEndTime.set('17:00');
    this.showRuleForm.set(true);
  }

  protected editRule(rule: AvailabilityRuleResponse): void {
    this.editingRuleId.set(rule.id);
    this.ruleWeekday.set(String(rule.weekday));
    this.ruleStartTime.set(rule.startTime);
    this.ruleEndTime.set(rule.endTime);
    this.showRuleForm.set(true);
  }

  protected closeRuleForm(): void {
    this.showRuleForm.set(false);
    this.editingRuleId.set(null);
  }

  protected saveRule(): void {
    if (!this.canSaveRule()) return;

    const data: CreateAvailabilityRuleRequest = {
      weekday: Number.parseInt(this.ruleWeekday(), 10),
      startTime: this.ruleStartTime(),
      endTime: this.ruleEndTime(),
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
    this.overrideDate.set(today);
    this.overrideIsAvailable.set(false);
    this.overrideStartTime.set('09:00');
    this.overrideEndTime.set('17:00');
    this.showOverrideForm.set(true);
  }

  protected editOverride(override: AvailabilityOverrideResponse): void {
    this.editingOverrideId.set(override.id);
    this.overrideDate.set(override.date);
    this.overrideIsAvailable.set(override.isAvailable);
    this.overrideStartTime.set(override.startTime ?? '09:00');
    this.overrideEndTime.set(override.endTime ?? '17:00');
    this.showOverrideForm.set(true);
  }

  protected closeOverrideForm(): void {
    this.showOverrideForm.set(false);
    this.editingOverrideId.set(null);
  }

  protected saveOverride(): void {
    if (!this.canSaveOverride()) return;

    const isAvailable = this.overrideIsAvailable();
    const data: CreateAvailabilityOverrideRequest = {
      date: this.overrideDate(),
      isAvailable,
      ...(isAvailable && {
        startTime: this.overrideStartTime(),
        endTime: this.overrideEndTime(),
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
