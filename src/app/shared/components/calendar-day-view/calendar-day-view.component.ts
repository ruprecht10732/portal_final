import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

export interface CalendarDayViewModel {
  displayName: string;
  ariaLabel: string;
  iso: string;
  inMonth: boolean;
  day: number;
}

@Component({
  selector: 'shared-calendar-day-view',
  templateUrl: './calendar-day-view.component.html',
  styleUrl: './calendar-day-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarDayViewComponent {
  readonly day = input<CalendarDayViewModel | null>(null);
  readonly isUnavailable = input(false);
  readonly startHour = input(8);
  readonly endHour = input(18);
  readonly hourStep = input(1);
  readonly blockedHours = input<readonly number[]>([]);
  readonly blockedRanges = input<readonly { start: number; end: number }[]>([]);
  readonly selectedTime = input<number | null>(null);
  readonly selected = output<CalendarDayViewModel>();
  readonly timeSelected = output<number>();

  protected readonly dayTitle = computed(() => {
    const day = this.day();
    if (!day) return '';
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(day.iso));
  });

  protected readonly daySubtitle = computed(() => {
    const day = this.day();
    if (!day) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(day.iso));
  });

  protected readonly hours = computed(() => {
    const start = Math.max(0, Math.min(23, this.startHour()));
    const end = Math.max(0, Math.min(24, this.endHour()));
    const step = Math.max(1, this.hourStep());
    const hours: { label: string; value: number }[] = [];
    for (let hour = start; hour < end; hour += step) {
      hours.push({
        label: new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: true,
        }).format(new Date(2026, 0, 1, hour, 0)),
        value: hour,
      });
    }
    return hours;
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

  protected isBlocked(hour: number): boolean {
    if (this.blockedHours().includes(hour)) return true;
    return this.blockedRanges().some(range => hour >= range.start && hour < range.end);
  }
}
