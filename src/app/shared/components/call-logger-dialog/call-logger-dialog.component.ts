 
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../button/button.component';
import type { LogCallResponse } from '../../../core/services/leads.types';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { DaySlots, TimeSlot } from '../../../core/services/appointments.types';
import { DatePipe } from '@angular/common';

export interface CallLoggerSubmitEvent {
  summary: string;
  sendConfirmationEmail: boolean;
}

@Component({
  selector: 'shared-call-logger-dialog',
  templateUrl: './call-logger-dialog.component.html',
  styleUrl: './call-logger-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe, DatePipe],
  host: {
    '[class.pointer-events-none]': '!isOpen()',
  },
})
export class CallLoggerDialogComponent {
  private readonly appointmentsService = inject(AppointmentsService);

  readonly isOpen = input<boolean>(false);
  readonly isProcessing = input<boolean>(false);
  readonly result = input<LogCallResponse | null>(null);
  readonly closeOnBackdrop = input<boolean>(true);
  readonly missingInformation = input<string[]>([]);

  readonly submitSummary = output<CallLoggerSubmitEvent>();
  readonly dismiss = output<void>();

  protected readonly summaryText = signal('');
  protected readonly maxSummaryLength = 2000;
  protected readonly summaryLength = computed(() => this.summaryText().length);
  protected readonly summaryTooLong = computed(() => this.summaryLength() > this.maxSummaryLength);
  protected readonly summaryRemaining = computed(() => Math.max(0, this.maxSummaryLength - this.summaryLength()));
  protected readonly summaryError = computed(() =>
    this.summaryTooLong()
      ? 'Maximum ' + this.maxSummaryLength + ' characters allowed.'
      : null
  );
  protected readonly sendConfirmationEmail = signal(true);
  protected readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('summaryTextarea');

  // Availability checker - Calendly-like week view
  protected readonly weekStartDate = signal<Date>(this.getNextMonday());
  protected readonly availableDays = signal<DaySlots[]>([]);
  protected readonly slotsLoading = signal(false);
  protected readonly slotsError = signal<string | null>(null);
  protected readonly showAvailabilityPanel = signal(false);
  protected readonly selectedSlot = signal<{ date: string; slot: TimeSlot } | null>(null);

  protected readonly dialogId = signal(`call-logger-${Math.random().toString(36).slice(2, 9)}`);
  protected readonly titleId = computed(() => `${this.dialogId()}-title`);
  protected readonly descriptionId = computed(() => `${this.dialogId()}-description`);

  protected readonly canSubmit = computed(() => {
    const text = this.summaryText().trim();
    return text.length > 0 && !this.isProcessing() && !this.result() && !this.summaryTooLong();
  });

  protected readonly showResult = computed(() => !!this.result());
  protected readonly hasMissingInfo = computed(() => this.missingInformation().length > 0);

  protected readonly weekDays = computed(() => {
    const start = this.weekStartDate();
    const days: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  });

  protected readonly weekLabel = computed(() => {
    const start = this.weekStartDate();
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    return { start, end };
  });

  protected readonly canGoPrevWeek = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.weekStartDate() > today;
  });

  constructor() {
    // Focus textarea when dialog opens
    effect(() => {
      if (!this.isOpen()) {
        // Reset state when dialog closes
        this.summaryText.set('');
        this.sendConfirmationEmail.set(true);
        this.weekStartDate.set(this.getNextMonday());
        this.availableDays.set([]);
        this.slotsError.set(null);
        this.showAvailabilityPanel.set(false);
        this.selectedSlot.set(null);
        return;
      }
      queueMicrotask(() => {
        this.textareaRef()?.nativeElement?.focus();
      });
    });
  }

  private getNextMonday(): Date {
    const today = new Date();
    const dayOfWeek = today.getDay();

    let daysUntilMonday: number;
    if (dayOfWeek === 0) {
      daysUntilMonday = 1; // Sunday -> next day is Monday
    } else if (dayOfWeek === 1) {
      daysUntilMonday = 0; // Already Monday
    } else {
      daysUntilMonday = 8 - dayOfWeek; // Other days -> next Monday
    }

    const monday = new Date(today);
    monday.setDate(today.getDate() + daysUntilMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop() && !this.isProcessing()) {
      this.dismiss.emit();
    }
  }

  protected onCancelClick(): void {
    if (!this.isProcessing()) {
      this.dismiss.emit();
    }
  }

  protected onSubmitClick(): void {
    if (this.canSubmit()) {
      this.submitSummary.emit({
        summary: this.summaryText().trim(),
        sendConfirmationEmail: this.sendConfirmationEmail(),
      });
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && this.canSubmit()) {
      event.preventDefault();
      this.onSubmitClick();
    }
  }

  protected toggleEmailConfirmation(): void {
    this.sendConfirmationEmail.set(!this.sendConfirmationEmail());
  }

  protected toggleAvailabilityPanel(): void {
    const isOpening = !this.showAvailabilityPanel();
    this.showAvailabilityPanel.set(isOpening);
    if (isOpening && this.availableDays().length === 0) {
      this.loadWeekSlots();
    }
  }

  protected goToPrevWeek(): void {
    if (!this.canGoPrevWeek()) return;
    const newStart = new Date(this.weekStartDate());
    newStart.setDate(newStart.getDate() - 7);
    this.weekStartDate.set(newStart);
    this.loadWeekSlots();
  }

  protected goToNextWeek(): void {
    const newStart = new Date(this.weekStartDate());
    newStart.setDate(newStart.getDate() + 7);
    this.weekStartDate.set(newStart);
    this.loadWeekSlots();
  }

  protected loadWeekSlots(): void {
    const start = this.weekStartDate();
    const end = new Date(start);
    end.setDate(start.getDate() + 4); // Mon-Fri

    this.slotsLoading.set(true);
    this.slotsError.set(null);

    this.appointmentsService
      .getAvailableSlots({
        startDate: this.formatDateISO(start),
        endDate: this.formatDateISO(end),
      })
      .subscribe({
        next: (response) => {
          this.availableDays.set(response.days || []);
          this.slotsLoading.set(false);
        },
        error: () => {
          this.slotsError.set('Failed to load availability');
          this.slotsLoading.set(false);
        },
      });
  }

  protected getSlotsForDate(date: Date): TimeSlot[] {
    const dateStr = this.formatDateISO(date);
    const daySlots = this.availableDays().find((d) => d.date === dateStr);
    return daySlots?.slots || [];
  }

  protected selectSlot(date: Date, slot: TimeSlot): void {
    this.selectedSlot.set({ date: this.formatDateISO(date), slot });
  }

  protected isSlotSelected(date: Date, slot: TimeSlot): boolean {
    const selected = this.selectedSlot();
    if (!selected) return false;
    return selected.date === this.formatDateISO(date) && selected.slot.startTime === slot.startTime;
  }

  protected formatTime(timeStr: string): string {
    // Handle both ISO datetime and HH:mm:ss formats
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return timeStr.slice(0, 5);
  }

  private formatDateISO(date: Date): string {
    // Use local date, not UTC (toISOString uses UTC which causes off-by-one errors in positive timezones)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }
}
