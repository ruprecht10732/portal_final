import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { Grid, GridCell, GridCellWidget, GridRow } from '@angular/aria/grid';

interface CalendarDay {
  displayName: string;
  ariaLabel: string;
  iso: string;
  inMonth: boolean;
  day: number;
}

@Component({
  selector: 'shared-calendar-grid',
  imports: [Grid, GridRow, GridCell, GridCellWidget],
  templateUrl: './calendar-grid.component.html',
  styleUrl: './calendar-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarGridComponent {
  protected readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  private readonly dayButtons = viewChildren(GridCellWidget);
  protected readonly currentMonth = signal(new Date());
  protected readonly selectedStart = signal<string | null>(null);
  protected readonly selectedEnd = signal<string | null>(null);
  protected readonly firstDayOfWeek = input(0);
  protected readonly allowRange = input(true);

  private readonly uid = 'calendar-' + Math.random().toString(36).substring(2, 9);
  protected readonly gridLabelId = `${this.uid}-label`;
  protected readonly instructionsId = `${this.uid}-instructions`;

  protected readonly monthLabel = computed(() => {
    const date = this.currentMonth();
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
  });

  private readonly firstWeekOffset = computed(() => {
    const date = this.currentMonth();
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDay = firstOfMonth.getDay();
    return (7 + firstDay - this.firstDayOfWeek()) % 7;
  });

  protected readonly weekdays = computed(() => {
    const firstDay = this.firstDayOfWeek();
    const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const narrow = this.dayNames;
    const days = long.map((name, index) => ({ long: name, narrow: narrow[index] }));
    return days.slice(firstDay).concat(days.slice(0, firstDay));
  });

  protected readonly daysFromPrevMonth = computed(() => {
    const date = this.currentMonth();
    const prevMonthNumDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    const days: number[] = [];
    for (let i = this.firstWeekOffset() - 1; i >= 0; i--) {
      days.push(prevMonthNumDays - i);
    }
    return days;
  });

  protected readonly weeks = computed(() => {
    const base = this.currentMonth();
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks: CalendarDay[][] = [];
    const offset = this.firstWeekOffset();

    for (let i = 0; i < daysInMonth; i++) {
      const rowIndex = Math.floor((i + offset) / 7);
      if (!weeks[rowIndex]) {
        weeks[rowIndex] = [];
      }
      const date = new Date(year, month, i + 1);
      weeks[rowIndex].push({
        displayName: String(i + 1),
        ariaLabel: date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        iso: date.toISOString().slice(0, 10),
        inMonth: true,
        day: i + 1,
      });
    }

    return weeks;
  });

  protected selectDay(day: CalendarDay): void {
    if (!this.allowRange()) {
      this.selectedStart.set(day.iso);
      this.selectedEnd.set(null);
      return;
    }

    const start = this.selectedStart();
    const end = this.selectedEnd();

    if (!start || end) {
      this.selectedStart.set(day.iso);
      this.selectedEnd.set(null);
      return;
    }

    if (this.compareIso(day.iso, start) < 0) {
      this.selectedEnd.set(start);
      this.selectedStart.set(day.iso);
      return;
    }

    this.selectedEnd.set(day.iso);
  }

  protected isSelected(day: CalendarDay): boolean {
    return this.selectedStart() === day.iso || this.selectedEnd() === day.iso;
  }

  protected isInRange(day: CalendarDay): boolean {
    if (!this.allowRange()) return false;
    const start = this.selectedStart();
    const end = this.selectedEnd();
    if (!start || !end) return false;
    return this.compareIso(day.iso, start) >= 0 && this.compareIso(day.iso, end) <= 0;
  }

  protected isRangeStart(day: CalendarDay): boolean {
    return this.selectedStart() === day.iso;
  }

  protected isRangeEnd(day: CalendarDay): boolean {
    return this.selectedEnd() === day.iso;
  }

  protected isToday(day: CalendarDay): boolean {
    const todayIso = new Date().toISOString().slice(0, 10);
    return day.iso === todayIso;
  }

  protected selectToday(): void {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    this.currentMonth.set(new Date(today.getFullYear(), today.getMonth(), 1));
    this.selectedStart.set(iso);
    this.selectedEnd.set(null);
  }

  protected previousMonth(): void {
    const date = this.currentMonth();
    this.currentMonth.set(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    const date = this.currentMonth();
    this.currentMonth.set(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  }

  protected scrollDown(): void {
    this.nextMonth();
    setTimeout(() => this.dayButtons()[0]?.element.focus());
  }

  protected scrollUp(): void {
    this.previousMonth();
    setTimeout(() => this.dayButtons()[this.dayButtons().length - 1]?.element.focus());
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const day = Number((event.target as HTMLElement).dataset['day']);
    if (!day) return;
    const viewMonthNumDays = this.daysInViewMonth();
    if (day > 7 && day <= viewMonthNumDays - 7) return;
    const arrowLeft = event.key === 'ArrowLeft';
    const arrowRight = event.key === 'ArrowRight';
    const arrowUp = event.key === 'ArrowUp';
    const arrowDown = event.key === 'ArrowDown';
    if ((day === 1 && arrowLeft) || (day <= 7 && arrowUp)) {
      this.scrollUp();
    }
    if ((day === viewMonthNumDays && arrowRight) || (day > viewMonthNumDays - 7 && arrowDown)) {
      this.scrollDown();
    }
  }

  private daysInViewMonth(): number {
    const date = this.currentMonth();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private compareIso(a: string, b: string): number {
    return new Date(a).getTime() - new Date(b).getTime();
  }
}
