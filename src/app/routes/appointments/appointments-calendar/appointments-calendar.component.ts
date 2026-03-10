import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { AppointmentResponse, ListAppointmentsParams } from '../../../core/services/appointments.types';
import { CalendarGridComponent, type CalendarEvent } from '../../../shared/components/calendar-grid/calendar-grid.component';
import { BottomSheetComponent } from '../../../shared/components/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { AppointmentFormComponent } from '../appointment-form/appointment-form.component';

@Component({
  selector: 'app-appointments-calendar',
  imports: [CalendarGridComponent, ButtonComponent, PageLayoutComponent, TranslatePipe, DatePipe, AppointmentFormComponent, BottomSheetComponent],
  templateUrl: './appointments-calendar.component.html',
  styleUrl: './appointments-calendar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'onWindowResize()',
  },
})
export class AppointmentsCalendarComponent {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly router = inject(Router);

  protected readonly view = signal<'day' | 'week' | 'month'>('month');
  protected readonly appointments = signal<AppointmentResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly currentMonth = signal(new Date());
  protected readonly showOverlay = signal(false);
  protected readonly overlayDate = signal<string | undefined>(undefined);
  protected readonly overlayTime = signal<number | undefined>(undefined);
  protected readonly isMobileViewport = signal(this.checkIsMobileViewport());

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
    this.overlayDate.set(data.date);
    this.overlayTime.set(data.time);
    this.showOverlay.set(true);
  }

  protected onCreateClick(): void {
    this.overlayDate.set(undefined);
    this.overlayTime.set(undefined);
    this.showOverlay.set(true);
  }

  protected onOverlayClosed(): void {
    this.showOverlay.set(false);
  }

  protected onAppointmentCreated(appointment: AppointmentResponse): void {
    this.showOverlay.set(false);
    this.loadAppointments();
    this.router.navigate(['/app/appointments', appointment.id]);
  }

  protected onWindowResize(): void {
    const nextIsMobile = this.checkIsMobileViewport();
    const currentIsMobile = this.isMobileViewport();
    if (nextIsMobile === currentIsMobile) {
      return;
    }

    this.isMobileViewport.set(nextIsMobile);

    // If viewport crosses breakpoint while overlay is open, remount once so
    // the correct overlay variant gets its open animation and cleanup cycle.
    if (this.showOverlay()) {
      this.showOverlay.set(false);
      requestAnimationFrame(() => {
        this.showOverlay.set(true);
      });
    }
  }

  private checkIsMobileViewport(): boolean {
    return globalThis.matchMedia('(max-width: 639px)').matches;
  }
}
