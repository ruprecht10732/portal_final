import { ChangeDetectionStrategy, Component, computed, HostListener, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LeadsService } from '../../../core/services/leads.service';
import type { AccessDifficulty, Lead, LeadNote, LeadNoteType, LeadService, LeadStatus, ServiceType, VisitHistory } from '../../../core/services/leads.types';
import { ACCESS_DIFFICULTY_OPTIONS, SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS, STATUS_COLORS, STATUS_LABELS, STATUS_OPTIONS } from '../../../core/services/leads.types';
import { UserService } from '../../../core/services/user.service';
import type { UserProfile } from '../../../core/services/user.types';
import { ActivityNotesComponent } from '../../../shared/components/activity-notes/activity-notes.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ContactInfoComponent } from '../../../shared/components/contact-info/contact-info.component';
import { LeadServicesCardComponent } from '../../../shared/components/lead-services-card/lead-services-card.component';
import { MapPreviewComponent } from '../../../shared/components/map-preview/map-preview.component';
import { type SelectOption } from '../../../shared/components/select/select.component';
import { VisitPanelComponent } from '../../../shared/components/visit-panel/visit-panel.component';
import { LeadDetailHeaderComponent } from './lead-detail-header.component';

@Component({
  selector: 'app-lead-detail',
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActivityNotesComponent, CardComponent, ButtonComponent, ConfirmDialogComponent, ContactInfoComponent, LeadServicesCardComponent, MapPreviewComponent, VisitPanelComponent, LeadDetailHeaderComponent],
})
export class LeadDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);
  private readonly userService = inject(UserService);

  protected readonly lead = signal<Lead | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly noteSaving = signal(false);
  protected readonly user = signal<UserProfile | null>(null);
  protected readonly assigneeOptions = signal<SelectOption<string | null>[]>([]);
  protected readonly selectedAssignee = signal<string | null>(null);
  protected readonly selectedScout = signal<string | null>(null);

  // Status change
  protected readonly newStatus = signal<LeadStatus | null>(null);

  protected readonly statusMenuOpen = signal(false);
  protected readonly activeTab = signal<'activity' | 'visit'>('visit');
  
  // Schedule visit
  protected readonly showScheduleForm = signal(false);
  protected readonly scheduledDate = signal('');
  protected readonly scheduledTime = signal('');

  // Reschedule visit
  protected readonly showRescheduleForm = signal(false);
  protected readonly rescheduleDate = signal('');
  protected readonly rescheduleTime = signal('');
  protected readonly noShowNotes = signal('');
  protected readonly markAsNoShow = signal(false);

  // Survey form
  protected readonly showSurveyForm = signal(false);
  protected readonly isEditingVisit = signal(false);
  protected readonly measurements = signal('');
  protected readonly accessDifficulty = signal<AccessDifficulty | null>(null);
  protected readonly surveyNotes = signal('');
  protected readonly surveyPhotos = signal<File[]>([]);

  protected readonly noteText = signal('');
  protected readonly noteType = signal<LeadNoteType>('note');
  protected readonly leadNotes = signal<LeadNote[]>([]);
  protected readonly visitHistory = signal<VisitHistory[]>([]);
  protected readonly copiedAddress = signal(false);
  protected readonly notePanelDesktop = viewChild<ActivityNotesComponent>('notePanelDesktop');
  protected readonly notePanelMobile = viewChild<ActivityNotesComponent>('notePanelMobile');

  // ARIA live region for announcements
  protected readonly announcement = signal<string>('');
  
  // Confirmation dialog
  protected readonly showConfirmDialog = signal(false);
  protected readonly confirmDialogTitle = signal('');
  protected readonly confirmDialogMessage = signal('');
  protected readonly pendingStatusChange = signal<LeadStatus | null>(null);

  // Services management
  protected readonly showAddServiceForm = signal(false);
  protected readonly newServiceType = signal<ServiceType | null>(null);
  protected readonly closeCurrentService = signal(true);
  protected readonly selectedServiceId = signal<string | null>(null);

  // Computed selected service - uses selectedServiceId or falls back to currentService
  protected readonly selectedService = computed(() => {
    const lead = this.lead();
    const selectedId = this.selectedServiceId();
    if (!lead) return null;
    if (!selectedId) return lead.currentService ?? null;
    return lead.services.find(s => s.id === selectedId) ?? lead.currentService ?? null;
  });

  protected readonly STATUS_LABELS = STATUS_LABELS;
  protected readonly STATUS_COLORS = STATUS_COLORS;
  protected readonly SERVICE_TYPE_LABELS = SERVICE_TYPE_LABELS;

  protected readonly serviceTypeOptions = computed(() => SERVICE_TYPE_OPTIONS);

  protected readonly statusOptions = computed<SelectOption<LeadStatus>[]>(() => STATUS_OPTIONS);
  protected readonly accessDifficultyOptions = computed<SelectOption<AccessDifficulty>[]>(() => ACCESS_DIFFICULTY_OPTIONS);
  protected readonly canAssign = computed(() => {
    const currentUser = this.user();
    const lead = this.lead();
    if (!currentUser || !lead) return false;
    if (currentUser.roles?.includes('admin')) return true;
    return lead.assignedAgentId === currentUser.id;
  });

  protected readonly headerStatusLabels = computed<Record<LeadStatus, string>>(() => ({
    New: 'New',
    Attempted_Contact: 'Contacted',
    Scheduled: 'Scheduled',
    Surveyed: 'Completed',
    Bad_Lead: 'Bad Lead',
    Needs_Rescheduling: 'Needs Rescheduling',
    Closed: 'Closed',
  }));

  protected readonly headerServiceTypeLabel = computed(() => {
    const service = this.selectedService();
    if (!service) return null;
    return this.SERVICE_TYPE_LABELS[service.serviceType] ?? service.serviceType;
  });

  protected readonly headerStatusLabel = computed(() => {
    const service = this.selectedService();
    if (!service) return 'No Service';
    return this.getStatusLabel(service.status);
  });

  protected readonly headerStatusPillClass = computed(() => {
    const service = this.selectedService();
    if (!service) return 'bg-zinc-100 text-zinc-600';
    return this.STATUS_COLORS[service.status];
  });

  protected readonly isVisitInFuture = computed(() => {
    const scheduledDate = this.selectedService()?.visit?.scheduledDate;
    if (!scheduledDate) return false;
    return new Date(scheduledDate) > new Date();
  });

  protected readonly activityFeed = computed<ActivityEntry[]>(() => {
    const lead = this.lead();
    const entries: ActivityEntry[] = [];
    const noteEntries = this.leadNotes().map(note => ({
      id: note.id,
      type: note.type ?? 'note',
      timestamp: note.createdAt,
      user: note.authorEmail,
      message: note.body,
    }));
    if (lead) {
      entries.push({
        id: `created-${lead.id}`,
        type: 'audit',
        timestamp: lead.createdAt,
        user: 'System',
        message: 'Lead created',
      });
      if (lead.updatedAt && lead.updatedAt !== lead.createdAt) {
        entries.push({
          id: `updated-${lead.id}`,
          type: 'audit',
          timestamp: lead.updatedAt,
          user: 'System',
          message: 'Lead updated',
        });
      }
      if (lead.viewedAt) {
        entries.push({
          id: `viewed-${lead.id}`,
          type: 'audit',
          timestamp: lead.viewedAt,
          user: 'System',
          message: 'Lead viewed',
        });
      }
      if (lead.currentService?.visit?.scheduledDate) {
        entries.push({
          id: `scheduled-${lead.id}`,
          type: 'audit',
          timestamp: this.getScheduledEventTimestamp(lead) ?? lead.currentService.visit.scheduledDate,
          user: 'System',
          message: 'Visit scheduled',
        });
      }
      if (lead.currentService?.visit?.completedAt) {
        entries.push({
          id: `completed-${lead.id}`,
          type: 'audit',
          timestamp: lead.currentService.visit.completedAt,
          user: 'System',
          message: 'Visit completed',
        });
      }
    }

    return [...noteEntries, ...entries].sort((a, b) => {
      const aTime = this.parseTimestamp(a.timestamp);
      const bTime = this.parseTimestamp(b.timestamp);
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      if (a.type !== b.type) {
        return a.type === 'note' ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });
  });

  protected readonly canSubmitNote = computed(() => {
    return this.noteText().trim().length > 0 && !this.noteSaving();
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.loadProfile();
      this.loadUsers();
      this.loadLead(id);
    }
  }

  private loadLead(id: string): void {
    this.loading.set(true);
    this.leadsService.getById(id).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.newStatus.set(lead.currentService?.status ?? null);
        this.selectedAssignee.set(lead.assignedAgentId ?? null);
        this.selectedScout.set(lead.currentService?.visit?.scoutId ?? lead.assignedAgentId ?? null);
        this.loading.set(false);
        this.loadNotes(lead.id);
        this.loadVisitHistory(lead.id);
        // Mark as viewed
        this.leadsService.markViewed(id).subscribe();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load lead');
        this.loading.set(false);
      },
    });
  }

  private loadProfile(): void {
    this.userService.getProfile().subscribe({
      next: profile => this.user.set(profile),
      error: () => this.error.set('Failed to load user profile'),
    });
  }

  private loadUsers(): void {
    this.userService.listUsers().subscribe({
      next: users => {
        const options = [
          { label: 'Unassigned', value: null },
          ...users.map(user => ({
            label: user.roles.length ? `${user.email} (${user.roles.join(', ')})` : user.email,
            value: user.id,
          })),
        ];
        this.assigneeOptions.set(options);
      },
      error: () => this.error.set('Failed to load users'),
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

  protected formatHumanDateTime(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const timeLabel = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    // Check if date is today (between start of today and start of tomorrow)
    if (date >= startOfToday && date < startOfTomorrow) {
      return `Today at ${timeLabel}`;
    }
    // Check if date is yesterday
    if (date >= startOfYesterday && date < startOfToday) {
      return `Yesterday at ${timeLabel}`;
    }

    // For other dates, show full date with time
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ` at ${timeLabel}`;
  }

  private parseTimestamp(value: string | null | undefined): number {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  }

  protected getScheduledEventTimestamp(lead: Lead): string | undefined {
    const scheduled = lead.currentService?.visit?.scheduledDate;
    if (!scheduled) return undefined;
    const scheduledTime = Date.parse(scheduled);
    const nowTime = Date.now();
    if (!Number.isNaN(scheduledTime) && scheduledTime > nowTime) {
      return lead.updatedAt ?? lead.createdAt ?? scheduled;
    }
    return scheduled;
  }

  protected getStatusLabel(status: LeadStatus): string {
    return this.headerStatusLabels()[status] || STATUS_LABELS[status];
  }

  protected toggleStatusMenu(): void {
    this.statusMenuOpen.update(open => !open);
  }

  protected closeStatusMenu(): void {
    this.statusMenuOpen.set(false);
  }

  protected selectStatus(status: LeadStatus): void {
    this.statusMenuOpen.set(false);
    
    // Check if this is a terminal status that needs confirmation
    if (this.isTerminalStatus(status) && status !== this.lead()?.currentService?.status) {
      this.pendingStatusChange.set(status);
      this.confirmDialogTitle.set(`Change to ${this.getStatusLabel(status)}?`);
      this.confirmDialogMessage.set(this.getConfirmMessage(status));
      this.showConfirmDialog.set(true);
      return;
    }
    
    this.newStatus.set(status);
    this.updateStatus(status);
  }

  private getConfirmMessage(status: LeadStatus): string {
    if (status === 'Bad_Lead') {
      return 'This will mark the lead as a bad lead. This action may affect reporting.';
    }
    if (status === 'Closed') {
      return 'This will close the lead. Make sure all work is completed.';
    }
    return 'Are you sure you want to make this change?';
  }

  protected confirmStatusChange(): void {
    const status = this.pendingStatusChange();
    if (status) {
      this.newStatus.set(status);
      this.updateStatus(status);
    }
    this.cancelConfirmDialog();
  }

  protected cancelConfirmDialog(): void {
    this.showConfirmDialog.set(false);
    this.pendingStatusChange.set(null);
    this.confirmDialogTitle.set('');
    this.confirmDialogMessage.set('');
  }

  // Keyboard handler for dropdowns and dialogs
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showConfirmDialog()) {
        this.cancelConfirmDialog();
        return;
      }
      if (this.statusMenuOpen()) {
        this.closeStatusMenu();
        return;
      }
      if (this.showScheduleForm()) {
        this.showScheduleForm.set(false);
        return;
      }
      if (this.showRescheduleForm()) {
        this.showRescheduleForm.set(false);
        return;
      }
      if (this.showSurveyForm()) {
        this.cancelEditVisit();
        return;
      }
      if (this.showAddServiceForm()) {
        this.cancelAddService();
        return;
      }
    }
  }

  protected getMapUrl(): string {
    const address = this.getFullAddress();
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
  }

  protected copyAddress(): void {
    const address = this.getFullAddress();
    if (!address) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(address).then(() => {
        this.copiedAddress.set(true);
        setTimeout(() => this.copiedAddress.set(false), 2000);
      });
      return;
    }
    this.copiedAddress.set(true);
    setTimeout(() => this.copiedAddress.set(false), 2000);
  }

  protected focusNoteBox(): void {
    const desktop = this.notePanelDesktop();
    const mobile = this.notePanelMobile();
    const target = desktop?.isVisible() ? desktop : mobile;
    target?.focusInput();
  }

  protected handlePhoneClick(): void {
    this.activeTab.set('activity');
    setTimeout(() => this.focusNoteBox(), 0);
  }

  protected updateStatus(statusOverride?: LeadStatus): void {
    const lead = this.lead();
    const status = statusOverride ?? this.newStatus();
    if (!lead || !status || status === lead.currentService?.status) return;

    this.saving.set(true);
    this.leadsService.updateStatus(lead.id, { status }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.saving.set(false);
        this.announce(`Status changed to ${this.getStatusLabel(status)}`);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to update status');
        this.saving.set(false);
      },
    });
  }

  protected assignLead(): void {
    const lead = this.lead();
    if (!lead) return;

    this.saving.set(true);
    this.leadsService.assign(lead.id, this.selectedAssignee()).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.selectedAssignee.set(updated.assignedAgentId ?? null);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to assign lead');
        this.saving.set(false);
      },
    });
  }

  protected scheduleVisit(): void {
    const lead = this.lead();
    if (!lead || !this.scheduledDate() || !this.scheduledTime()) return;

    const scheduledDate = new Date(`${this.scheduledDate()}T${this.scheduledTime()}`).toISOString();
    
    this.saving.set(true);
    this.leadsService.scheduleVisit(lead.id, {
      scheduledDate,
      scoutId: this.selectedScout() ?? undefined,
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showScheduleForm.set(false);
        this.scheduledDate.set('');
        this.scheduledTime.set('');
        this.saving.set(false);
        this.announce('Visit scheduled successfully');
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
        this.isEditingVisit.set(false);
        this.measurements.set('');
        this.accessDifficulty.set(null);
        this.surveyNotes.set('');
        this.surveyPhotos.set([]);
        this.saving.set(false);
        this.announce(this.isEditingVisit() ? 'Visit updated successfully' : 'Visit completed successfully');
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to complete survey');
        this.saving.set(false);
      },
    });
  }

  protected editVisit(): void {
    const lead = this.lead();
    const visit = lead?.currentService?.visit;
    if (!lead || !visit) return;
    this.measurements.set(visit.measurements ?? '');
    this.accessDifficulty.set(visit.accessDifficulty ?? null);
    this.surveyNotes.set(visit.notes ?? '');
    this.isEditingVisit.set(true);
    this.showSurveyForm.set(true);
  }

  protected cancelEditVisit(): void {
    this.showSurveyForm.set(false);
    this.isEditingVisit.set(false);
    this.measurements.set('');
    this.accessDifficulty.set(null);
    this.surveyNotes.set('');
    this.surveyPhotos.set([]);
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

  protected openRescheduleForm(): void {
    this.activeTab.set('visit');
    this.showRescheduleForm.set(true);
  }

  protected rescheduleVisit(): void {
    const lead = this.lead();
    if (!lead || !this.rescheduleDate() || !this.rescheduleTime()) return;

    const scheduledDate = new Date(`${this.rescheduleDate()}T${this.rescheduleTime()}`).toISOString();

    this.saving.set(true);
    this.leadsService.rescheduleVisit(lead.id, {
      scheduledDate,
      scoutId: this.selectedScout() ?? undefined,
      noShowNotes: this.noShowNotes() || undefined,
      markAsNoShow: this.markAsNoShow(),
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showRescheduleForm.set(false);
        this.rescheduleDate.set('');
        this.rescheduleTime.set('');
        this.noShowNotes.set('');
        this.markAsNoShow.set(false);
        this.saving.set(false);
        this.loadVisitHistory(lead.id);
        this.announce('Visit rescheduled successfully');
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to reschedule visit');
        this.saving.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/leads']);
  }

  protected addNote(): void {
    const lead = this.lead();
    const text = this.noteText().trim();
    if (!lead || !text || this.noteSaving()) return;

    this.noteSaving.set(true);
    this.leadsService.addNote(lead.id, { body: text, type: this.noteType() }).subscribe({
      next: (created) => {
        this.leadNotes.update(items => [created, ...items]);
        this.noteText.set('');
        this.noteType.set('note');
        this.noteSaving.set(false);
        this.focusNoteBox();
        this.announce('Note added successfully');
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to add note');
        this.noteSaving.set(false);
      },
    });
  }

  private loadNotes(id: string): void {
    this.leadsService.listNotes(id).subscribe({
      next: (response) => {
        this.leadNotes.set(response.items || []);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load notes');
      },
    });
  }

  private loadVisitHistory(id: string): void {
    this.leadsService.listVisitHistory(id).subscribe({
      next: (response) => {
        this.visitHistory.set(response.items || []);
      },
      error: () => {
        // Silently fail for visit history - not critical
      },
    });
  }

  protected onPhotosSelected(files: FileList | null): void {
    if (!files) return;
    this.surveyPhotos.set(Array.from(files));
  }

  protected getUserLabelById(id: string | null | undefined): string {
    if (!id) return 'Unassigned';
    const match = this.assigneeOptions().find(option => option.value === id);
    return match?.label ?? 'Unassigned';
  }

  protected getOutcomeLabel(outcome: string): string {
    const labels: Record<string, string> = {
      completed: 'Completed',
      no_show: 'No Show',
      rescheduled: 'Rescheduled',
      cancelled: 'Cancelled',
    };
    return labels[outcome] ?? outcome;
  }

  protected getOutcomeColor(outcome: string): string {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      no_show: 'bg-red-100 text-red-800',
      rescheduled: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-zinc-100 text-zinc-600',
    };
    return colors[outcome] ?? 'bg-zinc-100 text-zinc-600';
  }

  // Services management methods
  protected openAddServiceForm(): void {
    this.showAddServiceForm.set(true);
    this.newServiceType.set(null);
    this.closeCurrentService.set(true);
  }

  protected cancelAddService(): void {
    this.showAddServiceForm.set(false);
    this.newServiceType.set(null);
  }

  protected addService(): void {
    const lead = this.lead();
    const serviceType = this.newServiceType();
    if (!lead || !serviceType) return;

    this.saving.set(true);
    this.leadsService.addService(lead.id, {
      serviceType,
      closeCurrentStatus: this.closeCurrentService(),
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showAddServiceForm.set(false);
        this.newServiceType.set(null);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to add service');
        this.saving.set(false);
      },
    });
  }

  protected updateServiceStatus(service: LeadService, newStatus: LeadStatus): void {
    const lead = this.lead();
    if (!lead) return;

    this.saving.set(true);
    this.leadsService.updateServiceStatus(lead.id, service.id, { status: newStatus }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to update service status');
        this.saving.set(false);
      },
    });
  }

  protected selectService(service: LeadService): void {
    const previousId = this.selectedServiceId();
    this.selectedServiceId.set(service.id);
    
    // Reset form states when switching services
    if (previousId !== service.id) {
      this.showScheduleForm.set(false);
      this.showRescheduleForm.set(false);
      this.showSurveyForm.set(false);
      this.isEditingVisit.set(false);
    }
  }

  protected isTerminalStatus(status: LeadStatus): boolean {
    return status === 'Closed' || status === 'Bad_Lead' || status === 'Surveyed';
  }

  // Announce messages for screen readers
  private announce(message: string): void {
    this.announcement.set(message);
    setTimeout(() => this.announcement.set(''), 3000);
  }
}

interface ActivityEntry {
  id: string;
  type: 'audit' | LeadNoteType;
  timestamp: string;
  user: string;
  message: string;
}
