import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
  viewChildren,
} from '@angular/core';
import { Grid, GridCell, GridCellWidget, GridRow } from '@angular/aria/grid';
import { CalendarDayViewComponent } from '../calendar-day-view/calendar-day-view.component';

interface CalendarDay {
  displayName: string;
  ariaLabel: string;
  iso: string;
  inMonth: boolean;
  day: number;
}

@Component({
  selector: 'shared-calendar-grid',
  imports: [Grid, GridRow, GridCell, GridCellWidget, CalendarDayViewComponent],
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
  protected readonly hoverIso = signal<string | null>(null);
  readonly selectedTime = model<number | null>(null);
  readonly view = model<'day' | 'week' | 'month'>('month');
  readonly firstDayOfWeek = input(0);
  readonly allowRange = input(true);
  readonly unavailableDates = input<readonly string[]>([]);
  readonly showViews = input(true);
  readonly showToday = input(true);
  readonly showLegend = input(true);
  readonly showNav = input(true);
  readonly dayViewStartHour = input(8);
  readonly dayViewEndHour = input(18);
  readonly dayViewHourStep = input(1);
  readonly dayViewBlockedHours = input<readonly number[]>([]);
  readonly dayViewBlockedRanges = input<readonly { start: number; end: number }[]>([]);
  readonly dayViewTimeSlotMinutes = input<number | null>(null);
  readonly dayViewBlockedTimes = input<readonly number[]>([]);
  readonly dayViewBlockedTimeRanges = input<readonly { start: number; end: number }[]>([]);
  readonly showWeekNumbers = input(false);
  readonly showHolidays = input(true);
  readonly holidays = input<readonly { iso: string; name: string }[]>([]);

  private readonly uid = 'calendar-' + Math.random().toString(36).substring(2, 9);
  protected readonly gridLabelId = `${this.uid}-label`;
  protected readonly instructionsId = `${this.uid}-instructions`;

  protected readonly monthLabel = computed(() => {
    const date = this.currentMonth();
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
  });

  protected readonly activeDate = computed(() => {
    const selected = this.selectedStart();
    if (selected) return new Date(selected);
    return new Date();
  });

  protected readonly activeDay = computed<CalendarDay>(() => {
    const date = this.activeDate();
    return {
      displayName: String(date.getDate()),
      ariaLabel: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      iso: date.toISOString().slice(0, 10),
      inMonth: true,
      day: date.getDate(),
    };
  });

  protected readonly activeDayTitle = computed(() => {
    const date = this.activeDate();
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  });

  protected readonly activeDaySubtitle = computed(() => {
    const date = this.activeDate();
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  });

  protected readonly headerLabel = computed(() => {
    const view = this.view();
    const active = this.activeDate();
    if (view === 'day') {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(active);
    }
    if (view === 'week') {
      const [start, end] = this.weekRange(active);
      const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
      const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(active);
      return `${formatter.format(start)} - ${formatter.format(end)}, ${year}`;
    }
    return this.monthLabel();
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
        iso: this.formatLocalIso(date),
        inMonth: true,
        day: i + 1,
      });
    }

    return weeks;
  });

  protected readonly weekDays = computed(() => {
    const active = this.activeDate();
    const [start] = this.weekRange(active);
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({
        displayName: String(date.getDate()),
        ariaLabel: date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        iso: this.formatLocalIso(date),
        inMonth: date.getMonth() === this.currentMonth().getMonth(),
        day: date.getDate(),
      });
    }
    return days;
  });

  protected readonly weekNumbers = computed(() => {
    const base = this.currentMonth();
    const year = base.getFullYear();
    const month = base.getMonth();
    const offset = this.firstWeekOffset();
    const startDate = new Date(year, month, 1 - offset);
    const weeks = this.weeks();
    return weeks.map((_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index * 7);
      return this.getWeekNumber(date);
    });
  });

  protected readonly activeWeekNumber = computed(() => {
    return this.getWeekNumber(this.activeDate());
  });

  protected selectDay(day: CalendarDay): void {
    if (this.isUnavailable(day)) return;
    this.hoverIso.set(null);
    this.selectedTime.set(null);
    if (!this.allowRange()) {
      this.selectedStart.set(day.iso);
      this.selectedEnd.set(null);
      this.currentMonth.set(new Date(day.iso));
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
    this.currentMonth.set(new Date(day.iso));
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

  protected isInPreviewRange(day: CalendarDay): boolean {
    if (!this.allowRange()) return false;
    const start = this.selectedStart();
    const end = this.selectedEnd();
    const hover = this.hoverIso();
    if (!start || end || !hover) return false;
    const min = this.compareIso(start, hover) <= 0 ? start : hover;
    const max = this.compareIso(start, hover) <= 0 ? hover : start;
    return this.compareIso(day.iso, min) >= 0 && this.compareIso(day.iso, max) <= 0;
  }

  protected isRangeStart(day: CalendarDay): boolean {
    return this.selectedStart() === day.iso;
  }

  protected isRangeEnd(day: CalendarDay): boolean {
    return this.selectedEnd() === day.iso;
  }

  protected isToday(day: CalendarDay): boolean {
    const todayIso = this.formatLocalIso(new Date());
    return day.iso === todayIso;
  }

  protected isUnavailable(day: CalendarDay): boolean {
    return this.unavailableDates().includes(day.iso);
  }

  protected holidayName(day: CalendarDay): string | null {
    if (!this.showHolidays()) return null;
    const custom = this.holidays();
    const list = custom.length ? custom : this.defaultHolidays();
    const match = list.find(holiday => holiday.iso === day.iso);
    return match?.name ?? null;
  }

  protected isHoliday(day: CalendarDay): boolean {
    return this.holidayName(day) !== null;
  }

  protected onDayHover(day: CalendarDay): void {
    if (!this.allowRange()) return;
    if (this.selectedEnd()) return;
    if (!this.selectedStart()) return;
    if (this.isUnavailable(day)) return;
    this.hoverIso.set(day.iso);
  }

  protected clearHover(): void {
    this.hoverIso.set(null);
  }

  protected selectToday(): void {
    const today = new Date();
    const iso = this.formatLocalIso(today);
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

  protected previousPeriod(): void {
    const view = this.view();
    if (view === 'month') {
      this.previousMonth();
      return;
    }
    if (view === 'week') {
      this.shiftActiveDate(-7);
      return;
    }
    this.shiftActiveDate(-1);
  }

  protected nextPeriod(): void {
    const view = this.view();
    if (view === 'month') {
      this.nextMonth();
      return;
    }
    if (view === 'week') {
      this.shiftActiveDate(7);
      return;
    }
    this.shiftActiveDate(1);
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

  private weekRange(date: Date): [Date, Date] {
    const firstDay = this.firstDayOfWeek();
    const start = new Date(date);
    const offset = (7 + start.getDay() - firstDay) % 7;
    start.setDate(start.getDate() - offset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [start, end];
  }

  private shiftActiveDate(days: number): void {
    const active = this.activeDate();
    active.setDate(active.getDate() + days);
    const iso = this.formatLocalIso(active);
    this.selectedStart.set(iso);
    this.selectedEnd.set(null);
    this.currentMonth.set(new Date(active.getFullYear(), active.getMonth(), 1));
  }

  protected getWeekNumber(date: Date): number {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    const diff = temp.getTime() - yearStart.getTime();
    return Math.ceil((diff / 86400000 + 1) / 7);
  }

  private defaultHolidays(): { iso: string; name: string }[] {
    const year = this.currentMonth().getFullYear();
    const newYears = new Date(year, 0, 1);
    const independence = new Date(year, 6, 4);
    const christmas = new Date(year, 11, 25);
    const thanksgiving = this.nthWeekdayOfMonth(year, 10, 4, 4);
    const list = [
      { iso: this.formatLocalIso(newYears), name: 'New Year\'s Day' },
      { iso: this.formatLocalIso(independence), name: 'Independence Day' },
      { iso: this.formatLocalIso(thanksgiving), name: 'Thanksgiving' },
      { iso: this.formatLocalIso(christmas), name: 'Christmas Day' },
    ];
    return list;
  }

  private formatLocalIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
    const first = new Date(year, month, 1);
    const offset = (7 + weekday - first.getDay()) % 7;
    return new Date(year, month, 1 + offset + (nth - 1) * 7);
  }

  private compareIso(a: string, b: string): number {
    return new Date(a).getTime() - new Date(b).getTime();
  }
}
