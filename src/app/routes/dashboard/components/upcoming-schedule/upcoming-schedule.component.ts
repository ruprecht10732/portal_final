import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DashboardScheduleService } from '../../../../core/services/dashboard-schedule.service';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import {
  APPOINTMENT_STATUS_COLORS,
  type AppointmentResponse,
  type AppointmentStatus,
  type AppointmentType,
} from '../../../../core/services/appointments.types';

@Component({
  selector: 'app-dashboard-upcoming-schedule',
  templateUrl: './upcoming-schedule.component.html',
  styleUrl: './upcoming-schedule.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, RouterLink, TranslatePipe, StatusBadgeComponent],
})
export class UpcomingScheduleComponent {
  protected readonly scheduleService = inject(DashboardScheduleService);
  private readonly translate = inject(TranslateService);

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
    const keyMap: Record<AppointmentType, string> = {
      lead_visit: 'appointments.type.leadVisit',
      standalone: 'appointments.type.standalone',
      blocked: 'appointments.type.blocked',
    };
    return this.translate.instant(keyMap[type]);
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
    return APPOINTMENT_STATUS_COLORS[status];
  }

  protected statusLabel(status: AppointmentStatus): string {
    const keyMap: Record<AppointmentStatus, string> = {
      scheduled: 'appointments.status.scheduled',
      completed: 'appointments.status.completed',
      cancelled: 'appointments.status.cancelled',
      no_show: 'appointments.status.noShow',
    };
    return this.translate.instant(keyMap[status]);
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
