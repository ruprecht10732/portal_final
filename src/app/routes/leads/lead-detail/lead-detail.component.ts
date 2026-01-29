import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LeadsService } from '../../../core/services/leads.service';
import type { Lead, LeadStatus, AccessDifficulty } from '../../../core/services/leads.types';
import { STATUS_LABELS, STATUS_COLORS, STATUS_OPTIONS, ACCESS_DIFFICULTY_OPTIONS } from '../../../core/services/leads.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';

@Component({
  selector: 'app-lead-detail',
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonComponent, InputComponent, SelectComponent, TextareaComponent],
})
export class LeadDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);

  protected readonly lead = signal<Lead | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  // Status change
  protected readonly newStatus = signal<LeadStatus | null>(null);
  
  // Schedule visit
  protected readonly showScheduleForm = signal(false);
  protected readonly scheduledDate = signal('');
  protected readonly scheduledTime = signal('');

  // Survey form
  protected readonly showSurveyForm = signal(false);
  protected readonly measurements = signal('');
  protected readonly accessDifficulty = signal<AccessDifficulty | null>(null);
  protected readonly surveyNotes = signal('');

  protected readonly STATUS_LABELS = STATUS_LABELS;
  protected readonly STATUS_COLORS = STATUS_COLORS;

  protected readonly statusOptions = computed<SelectOption<LeadStatus>[]>(() => STATUS_OPTIONS);
  protected readonly accessDifficultyOptions = computed<SelectOption<AccessDifficulty>[]>(() => ACCESS_DIFFICULTY_OPTIONS);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.loadLead(id);
    }
  }

  private loadLead(id: string): void {
    this.loading.set(true);
    this.leadsService.getById(id).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.newStatus.set(lead.status);
        this.loading.set(false);
        // Mark as viewed
        this.leadsService.markViewed(id).subscribe();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load lead');
        this.loading.set(false);
      },
    });
  }

  protected getFullName(): string {
    const lead = this.lead();
    if (!lead) return '';
    return `${lead.consumer.firstName} ${lead.consumer.lastName}`;
  }

  protected getFullAddress(): string {
    const lead = this.lead();
    if (!lead) return '';
    return `${lead.address.street} ${lead.address.houseNumber}, ${lead.address.zipCode} ${lead.address.city}`;
  }

  protected formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  }

  protected formatDateTime(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  }

  protected updateStatus(): void {
    const lead = this.lead();
    const status = this.newStatus();
    if (!lead || !status || status === lead.status) return;

    this.saving.set(true);
    this.leadsService.updateStatus(lead.id, { status }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to update status');
        this.saving.set(false);
      },
    });
  }

  protected scheduleVisit(): void {
    const lead = this.lead();
    if (!lead || !this.scheduledDate() || !this.scheduledTime()) return;

    const scheduledDate = new Date(`${this.scheduledDate()}T${this.scheduledTime()}`).toISOString();
    
    this.saving.set(true);
    this.leadsService.scheduleVisit(lead.id, { scheduledDate }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showScheduleForm.set(false);
        this.scheduledDate.set('');
        this.scheduledTime.set('');
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to schedule visit');
        this.saving.set(false);
      },
    });
  }

  protected completeSurvey(): void {
    const lead = this.lead();
    const difficulty = this.accessDifficulty();
    if (!lead || !this.measurements() || !difficulty) return;

    this.saving.set(true);
    this.leadsService.completeSurvey(lead.id, {
      measurements: this.measurements(),
      accessDifficulty: difficulty,
      notes: this.surveyNotes() || undefined,
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showSurveyForm.set(false);
        this.measurements.set('');
        this.accessDifficulty.set(null);
        this.surveyNotes.set('');
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to complete survey');
        this.saving.set(false);
      },
    });
  }

  protected markNoShow(): void {
    const lead = this.lead();
    if (!lead) return;

    this.saving.set(true);
    this.leadsService.markNoShow(lead.id, { notes: 'Customer not home' }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to mark no show');
        this.saving.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/leads']);
  }
}
