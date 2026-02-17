import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { DashboardScheduleService } from '../../../../core/services/dashboard-schedule.service';
import {
  type AppointmentResponse,
  type AppointmentStatus,
  type AppointmentType,
} from '../../../../core/services/appointments.types';

@Component({
  selector: 'app-dashboard-upcoming-schedule',
  templateUrl: './upcoming-schedule.component.html',
  styleUrl: './upcoming-schedule.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, LucideAngularModule],
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
        return 'house';
      case 'standalone':
        return 'calendar-check';
      case 'blocked':
        return 'lock';
    }
  }

  protected statusLabel(status: AppointmentStatus): string {
    const keyMap: Record<AppointmentStatus, string> = {
      scheduled: 'appointments.status.scheduled',
      requested: 'appointments.status.requested',
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

  /** Tailwind bg classes for the icon avatar per appointment type. */
  protected apptIconBg(appt: AppointmentResponse): string {
    switch (appt.type) {
      case 'lead_visit':
        return 'bg-blue-500';
      case 'standalone':
        return 'bg-emerald-500';
      case 'blocked':
        return 'bg-zinc-400';
    }
  }

  /** Tailwind classes for the status chip. */
  protected apptStatusChip(status: AppointmentStatus): string {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400';
      case 'requested':
        return 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400';
      case 'completed':
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400';
      case 'cancelled':
        return 'bg-red-50 text-red-500 dark:bg-red-950/50 dark:text-red-400';
      case 'no_show':
        return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
    }
  }
}
