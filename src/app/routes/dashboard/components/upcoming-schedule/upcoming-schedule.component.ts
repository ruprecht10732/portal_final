import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { DashboardScheduleService } from '../../../../core/services/dashboard-schedule.service';
import { CardComponent } from '../../../../shared/components/card/card.component';
import type { AppointmentResponse, AppointmentStatus, AppointmentType } from '../../../../core/services/appointments.types';

@Component({
  selector: 'app-dashboard-upcoming-schedule',
  templateUrl: './upcoming-schedule.component.html',
  styleUrl: './upcoming-schedule.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, RouterLink, TranslatePipe],
})
export class UpcomingScheduleComponent {
  protected readonly scheduleService = inject(DashboardScheduleService);

  /**
   * Format "2026-02-07T09:00:00Z" → "09:00"
   */
  protected formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Format time range "09:00 – 10:00"
   */
  protected timeRange(start: string, end: string): string {
    return `${this.formatTime(start)} – ${this.formatTime(end)}`;
  }

  protected typeLabel(type: AppointmentType): string {
    switch (type) {
      case 'lead_visit':
        return 'Inspectie';
      case 'standalone':
        return 'Intern';
      case 'blocked':
        return 'Geblokkeerd';
    }
  }

  protected typeIcon(type: AppointmentType): string {
    switch (type) {
      case 'lead_visit':
        return '🏠';
      case 'standalone':
        return '📋';
      case 'blocked':
        return '🚫';
    }
  }

  protected statusColor(status: AppointmentStatus): string {
    switch (status) {
      case 'scheduled':
        return 'border-blue-500 bg-blue-50 text-blue-700';
      case 'completed':
        return 'border-emerald-500 bg-emerald-50 text-emerald-700';
      case 'cancelled':
        return 'border-zinc-400 bg-zinc-50 text-zinc-500';
      case 'no_show':
        return 'border-red-500 bg-red-50 text-red-700';
    }
  }

  protected statusLabel(status: AppointmentStatus): string {
    switch (status) {
      case 'scheduled':
        return 'Gepland';
      case 'completed':
        return 'Voltooid';
      case 'cancelled':
        return 'Geannuleerd';
      case 'no_show':
        return 'No-show';
    }
  }

  protected customerLabel(appt: AppointmentResponse): string {
    if (appt.lead) {
      return `${appt.lead.firstName} ${appt.lead.lastName}`;
    }
    return appt.title;
  }

  protected addressLabel(appt: AppointmentResponse): string | null {
    return appt.lead?.address ?? appt.location ?? null;
  }
}
