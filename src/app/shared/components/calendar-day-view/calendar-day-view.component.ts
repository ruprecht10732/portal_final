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
  readonly selected = output<CalendarDayViewModel>();

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
    return Array.from({ length: 24 }, (_, index) => ({
      label: new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: true,
      }).format(new Date(2026, 0, 1, index, 0)),
      value: index,
    }));
  });

  protected handleSelect(): void {
    const day = this.day();
    if (!day || this.isUnavailable()) return;
    this.selected.emit(day);
  }
}
