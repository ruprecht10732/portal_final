import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppointmentsService } from './appointments.service';
import { SSEService } from './sse.service';
import type { AppointmentResponse } from './appointments.types';
import type { ScheduleDayGroup } from './dashboard-schedule.types';

/**
 * Service that fetches the agent's upcoming schedule (next 3 days)
 * and refreshes automatically when appointment SSE events arrive.
 */
@Injectable({ providedIn: 'root' })
export class DashboardScheduleService {
  private readonly appointments = inject(AppointmentsService);
  private readonly sse = inject(SSEService);
  private readonly destroyRef = inject(DestroyRef);

  readonly schedule = signal<ScheduleDayGroup[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
    this.listenForUpdates();
  }

  /** Manually trigger a reload. */
  refresh(): void {
    this.load();
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    const now = new Date();
    const startFrom = this.formatDate(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 2); // today + 2 = 3 days
    const startTo = this.formatDate(end);

    this.appointments
      .list({
        startFrom,
        startTo,
        sortBy: 'startTime',
        sortOrder: 'asc',
        pageSize: 50,
        page: 1,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.schedule.set(this.groupByDate(res.items, now));
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Kon agenda niet laden');
          this.loading.set(false);
        },
      });
  }

  /** Re-fetch when any appointment event arrives via SSE. */
  private listenForUpdates(): void {
    this.sse.appointmentEvent
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  // ---------------------------------------------------------------------------
  // Grouping
  // ---------------------------------------------------------------------------

  private groupByDate(items: AppointmentResponse[], now: Date): ScheduleDayGroup[] {
    const map = new Map<string, AppointmentResponse[]>();

    // Pre-populate 3 days so empty days still show
    for (let i = 0; i < 3; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      map.set(this.formatDate(d), []);
    }

    for (const appt of items) {
      const key = appt.startTime.substring(0, 10); // YYYY-MM-DD
      const list = map.get(key);
      if (list) {
        list.push(appt);
      } else {
        map.set(key, [appt]);
      }
    }

    const groups: ScheduleDayGroup[] = [];
    for (const [date, appointments] of map) {
      const sorted = [...appointments];
      sorted.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      groups.push({ date, label: this.dayLabel(date, now), appointments: sorted });
    }
    groups.sort((a, b) => a.date.localeCompare(b.date));
    return groups;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private dayLabel(dateStr: string, now: Date): string {
    const today = this.formatDate(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = this.formatDate(tomorrow);

    if (dateStr === today) return 'Vandaag';
    if (dateStr === tomorrowStr) return 'Morgen';

    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
