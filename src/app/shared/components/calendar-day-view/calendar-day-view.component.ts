import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

export interface CalendarDayViewModel {
  displayName: string;
  ariaLabel: string;
  iso: string;
  inMonth: boolean;
  day: number;
}

export interface CalendarDayEvent {
  id: string | number;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  status?: string;
  color?: string;
  data?: unknown;
}

@Component({
  selector: 'shared-calendar-day-view',
  templateUrl: './calendar-day-view.component.html',
  styleUrl: './calendar-day-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarDayViewComponent {
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: {
      lang: this.translate.currentLang || this.translate.getDefaultLang() || 'en',
      translations: {},
    },
  });
  protected readonly locale = computed(() => {
    this.lang();
    return this.translate.currentLang || this.translate.getDefaultLang() || 'en';
  });
  readonly day = input<CalendarDayViewModel | null>(null);
  readonly isUnavailable = input(false);
  readonly holidayName = input<string | null>(null);
  readonly startHour = input(8);
  readonly endHour = input(18);
  readonly hourStep = input(1);
  readonly timeSlotMinutes = input<number | null>(null);
  readonly blockedHours = input<readonly number[]>([]);
  readonly blockedRanges = input<readonly { start: number; end: number }[]>([]);
  readonly blockedTimes = input<readonly number[]>([]);
  readonly blockedTimeRanges = input<readonly { start: number; end: number }[]>([]);
  readonly selectedTime = input<number | null>(null);
  readonly events = input<readonly CalendarDayEvent[]>([]);
  readonly selected = output<CalendarDayViewModel>();
  readonly timeSelected = output<number>();
  readonly eventClick = output<CalendarDayEvent>();
  readonly slotClick = output<{ date: string; time: number }>();

  protected readonly dayTitle = computed(() => {
    const day = this.day();
    if (!day) return '';
    return new Intl.DateTimeFormat(this.locale(), { weekday: 'long' }).format(new Date(day.iso));
  });

  protected readonly daySubtitle = computed(() => {
    const day = this.day();
    if (!day) return '';
    return new Intl.DateTimeFormat(this.locale(), {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(day.iso));
  });

  protected readonly hours = computed(() => {
    const startMinutes = Math.max(0, Math.min(23, this.startHour())) * 60;
    const endMinutes = Math.max(0, Math.min(24, this.endHour())) * 60;
    const stepMinutes = this.timeSlotMinutes() ?? Math.max(1, this.hourStep()) * 60;
    const slots: { label: string; value: number }[] = [];
    for (let minutes = startMinutes; minutes < endMinutes; minutes += stepMinutes) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      slots.push({
        label: new Intl.DateTimeFormat(this.locale(), {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(2026, 0, 1, hour, minute)),
        value: minutes,
      });
    }
    return slots;
  });

  protected handleSelect(): void {
    const day = this.day();
    if (!day || this.isUnavailable()) return;
    this.selected.emit(day);
  }

  protected selectHour(hour: number): void {
    if (this.isBlocked(hour)) return;
    this.timeSelected.emit(hour);
  }

  protected onSlotClick(minutes: number): void {
    const day = this.day();
    if (!day || this.isBlocked(minutes)) return;
    this.slotClick.emit({ date: day.iso, time: minutes });
  }

  protected slotAriaLabel(label: string): string {
    const day = this.day();
    if (!day) {
      return this.translate.instant('appointments.calendarUi.selectTime', { time: label });
    }
    return this.translate.instant('appointments.calendarUi.selectTimeOn', {
      time: label,
      day: day.ariaLabel,
    });
  }

  protected onEventClick(event: CalendarDayEvent, clickEvent: MouseEvent): void {
    clickEvent.stopPropagation();
    this.eventClick.emit(event);
  }

  protected getEventsForSlot(slotMinutes: number): CalendarDayEvent[] {
    const slotDuration = this.timeSlotMinutes() ?? this.hourStep() * 60;
    const slotEnd = slotMinutes + slotDuration;
    
    return this.events().filter(event => {
      const eventStart = typeof event.start === 'string' ? new Date(event.start) : event.start;
      const eventMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
      return eventMinutes >= slotMinutes && eventMinutes < slotEnd;
    });
  }

  protected isBlocked(minutes: number): boolean {
    const blockedTimes = this.blockedTimes();
    const blockedRanges = this.blockedTimeRanges();
    if (blockedTimes.length || blockedRanges.length) {
      if (blockedTimes.includes(minutes)) return true;
      return blockedRanges.some(range => minutes >= range.start && minutes < range.end);
    }

    const hour = Math.floor(minutes / 60);
    if (this.blockedHours().includes(hour)) return true;
    return this.blockedRanges().some(range => hour >= range.start && hour < range.end);
  }
}
