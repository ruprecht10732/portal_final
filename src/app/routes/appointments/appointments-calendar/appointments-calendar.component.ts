import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { AppointmentResponse, ListAppointmentsParams } from '../../../core/services/appointments.types';
import { CalendarGridComponent, type CalendarEvent } from '../../../shared/components/calendar-grid/calendar-grid.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-appointments-calendar',
  imports: [CalendarGridComponent, ButtonComponent, TranslatePipe],
  templateUrl: './appointments-calendar.component.html',
  styleUrl: './appointments-calendar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentsCalendarComponent {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly router = inject(Router);

  protected readonly view = signal<'day' | 'week' | 'month'>('month');
  protected readonly appointments = signal<AppointmentResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly currentMonth = signal(new Date());

  protected readonly calendarEvents = computed<CalendarEvent[]>(() => {
    return this.appointments().map(apt => this.appointmentToEvent(apt));
  });

  constructor() {
    effect(() => {
      this.loadAppointments();
    });
  }

  private loadAppointments(): void {
    const current = this.currentMonth();
    const startOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
    const endOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    // Extend range for week view overflow
    startOfMonth.setDate(startOfMonth.getDate() - 7);
    endOfMonth.setDate(endOfMonth.getDate() + 7);

    const params: ListAppointmentsParams = {
      startFrom: this.formatDate(startOfMonth),
      startTo: this.formatDate(endOfMonth),
      pageSize: 100,
    };

    this.loading.set(true);
    this.appointmentsService.list(params).subscribe({
      next: (response) => {
        this.appointments.set(response.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private appointmentToEvent(apt: AppointmentResponse): CalendarEvent {
    return {
      id: apt.id,
      title: apt.title,
      start: apt.startTime,
      end: apt.endTime,
      allDay: apt.allDay,
      status: apt.status,
      data: apt,
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0] ?? '';
  }

  protected onEventClick(event: CalendarEvent): void {
    this.router.navigate(['/app/appointments', event.id]);
  }

  protected onSlotClick(data: { date: string; time?: number }): void {
    const queryParams: Record<string, string> = { date: data.date };
    if (data.time !== undefined) {
      queryParams['time'] = String(data.time);
    }
    this.router.navigate(['/app/appointments/new'], { queryParams });
  }

  protected onCreateClick(): void {
    this.router.navigate(['/app/appointments/new']);
  }
}
