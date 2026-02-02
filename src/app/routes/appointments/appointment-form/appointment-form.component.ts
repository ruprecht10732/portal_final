import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import type { CreateAppointmentRequest, AppointmentType } from '../../../core/services/appointments.types';
import { LeadsService } from '../../../core/services/leads.service';
import type { Lead, LeadService } from '../../../core/services/leads.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';

@Component({
  selector: 'app-appointment-form',
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, InputComponent, TextareaComponent, SelectComponent, CheckboxComponent, AutocompleteComponent, LucideAngularModule, TranslatePipe],
})
export class AppointmentFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly leadsService = inject(LeadsService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly typeOptions: SelectOption<AppointmentType>[] = [
    { value: 'lead_visit', label: 'Lead Visit' },
    { value: 'standalone', label: 'Standalone' },
    { value: 'blocked', label: 'Blocked Time' },
  ];

  protected readonly type = signal<AppointmentType>('standalone');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly location = signal('');
  protected readonly startTime = signal('');
  protected readonly endTime = signal('');
  protected readonly allDay = signal(false);
  protected readonly sendConfirmationEmail = signal(true);

  // Lead selection
  protected readonly selectedLead = signal<Lead | null>(null);
  protected readonly leadSearchQuery = signal('');
  protected readonly leadOptions = signal<AutocompleteOption[]>([]);
  private readonly leadSuggestions = signal<Lead[]>([]);

  // Lead service selection
  protected readonly selectedLeadServiceId = signal<string | null>(null);
  protected readonly leadServiceOptions = computed<SelectOption<string>[]>(() => {
    const lead = this.selectedLead();
    if (!lead?.services?.length) return [];
    return lead.services.map((s: LeadService) => ({
      label: s.serviceType,
      value: s.id,
    }));
  });

  protected readonly isLeadVisit = computed(() => this.type() === 'lead_visit');

  protected readonly canCreate = computed(() => {
    const hasBasicInfo = this.title().trim() !== '' && this.startTime() !== '' && this.endTime() !== '';
    if (!hasBasicInfo) return false;

    // For lead_visit type, lead and service are required
    if (this.isLeadVisit()) {
      return this.selectedLead() !== null && this.selectedLeadServiceId() !== null;
    }
    return true;
  });

  ngOnInit(): void {
    // Pre-fill from query params if provided (from calendar slot click)
    const queryParams = this.route.snapshot.queryParams;
    if (queryParams['date']) {
      const date = queryParams['date'];
      const time = queryParams['time'] ? Number.parseInt(queryParams['time'], 10) : 9 * 60;
      
      const startDate = new Date(date);
      startDate.setHours(Math.floor(time / 60), time % 60, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + 60); // Default 1 hour duration

      this.startTime.set(this.formatDateTimeLocal(startDate));
      this.endTime.set(this.formatDateTimeLocal(endDate));
    } else {
      // Default to current date/time
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const end = new Date(now);
      end.setHours(end.getHours() + 1);

      this.startTime.set(this.formatDateTimeLocal(now));
      this.endTime.set(this.formatDateTimeLocal(end));
    }

    // Check for leadId in query params (from lead profile page)
    const leadId = queryParams['leadId'];
    if (leadId) {
      this.type.set('lead_visit');
      this.loadLead(leadId);
    }
  }

  private loadLead(leadId: string): void {
    this.leadsService.getById(leadId).subscribe({
      next: lead => {
        this.selectedLead.set(lead);
        this.leadSearchQuery.set(this.formatLeadLabel(lead));
        // Auto-select first service
        if (lead.services?.length) {
          this.selectedLeadServiceId.set(lead.services[0].id);
        }
        // Pre-fill location from lead address
        if (lead.address && !this.location()) {
          this.location.set(`${lead.address.street} ${lead.address.houseNumber}, ${lead.address.zipCode} ${lead.address.city}`);
        }
      },
      error: err => {
        this.reporter.report(err, { source: 'http', silent: true });
      },
    });
  }

  private formatLeadLabel(lead: Lead): string {
    return `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`;
  }

  protected onLeadSearchChange(value: string): void {
    this.leadSearchQuery.set(value);

    if (value.length < 2) {
      this.leadOptions.set([]);
      this.leadSuggestions.set([]);
      return;
    }

    this.leadsService.list({ search: value, pageSize: 10 }).subscribe({
      next: response => {
        this.leadSuggestions.set(response.items);
        this.leadOptions.set(
          response.items.map(lead => ({
            label: this.formatLeadLabel(lead),
            value: lead.id,
          }))
        );
      },
      error: () => {
        this.leadOptions.set([]);
      },
    });
  }

  protected onLeadSelected(value: string): void {
    const lead = this.leadSuggestions().find(l => {
      const label = this.formatLeadLabel(l);
      return label === value || l.id === value;
    });

    if (lead) {
      this.selectedLead.set(lead);
      this.leadSearchQuery.set(this.formatLeadLabel(lead));
      // Reset service selection and auto-select first
      this.selectedLeadServiceId.set(lead.services?.length ? lead.services[0].id : null);
      // Pre-fill location from lead address
      if (lead.address) {
        this.location.set(`${lead.address.street} ${lead.address.houseNumber}, ${lead.address.zipCode} ${lead.address.city}`);
      }
    }
  }

  protected clearLead(): void {
    this.selectedLead.set(null);
    this.leadSearchQuery.set('');
    this.leadOptions.set([]);
    this.leadSuggestions.set([]);
    this.selectedLeadServiceId.set(null);
  }

  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  protected createAppointment(): void {
    if (!this.canCreate()) return;

    this.saving.set(true);
    this.error.set(null);

    const data: CreateAppointmentRequest = {
      type: this.type(),
      title: this.title(),
      description: this.description() || undefined,
      location: this.location() || undefined,
      startTime: new Date(this.startTime()).toISOString(),
      endTime: new Date(this.endTime()).toISOString(),
      allDay: this.allDay(),
    };

    // Add lead-specific fields for lead_visit type
    if (this.isLeadVisit()) {
      data.leadId = this.selectedLead()?.id;
      data.leadServiceId = this.selectedLeadServiceId() ?? undefined;
      data.sendConfirmationEmail = this.sendConfirmationEmail();
    }

    this.appointmentsService.create(data).subscribe({
      next: (created) => {
        this.router.navigate(['/app/appointments', created.id]);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('appointments.form.errors.create'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/appointments']);
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      if (typeof e['message'] === 'string') return e['message'];
      if (e['error'] && typeof e['error'] === 'object') {
        const nested = e['error'] as Record<string, unknown>;
        if (typeof nested['message'] === 'string') return nested['message'];
      }
    }
    return fallback;
  }
}
