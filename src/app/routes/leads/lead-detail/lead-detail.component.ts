import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { LeadsService } from '../../../core/services/leads.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import type { AccessDifficulty, Lead, LeadAIAnalysis, LeadNote, LeadNoteType, LeadService, LeadStatus, VisitHistory } from '../../../core/services/leads.types';
import { ACCESS_DIFFICULTY_OPTIONS, STATUS_COLORS, STATUS_LABELS, STATUS_OPTIONS } from '../../../core/services/leads.types';
import { UserService } from '../../../core/services/user.service';
import type { UserProfile } from '../../../core/services/user.types';
import { ActivityNotesComponent } from '../../../shared/components/activity-notes/activity-notes.component';
import { AiAdvisorPanelComponent } from '../../../shared/components/ai-advisor-panel/ai-advisor-panel.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ContactInfoComponent } from '../../../shared/components/contact-info/contact-info.component';
import { LeadServicesCardComponent } from '../../../shared/components/lead-services-card/lead-services-card.component';
import { MapPreviewComponent } from '../../../shared/components/map-preview/map-preview.component';
import { type SelectOption } from '../../../shared/components/select/select.component';
import { VisitPanelComponent } from '../../../shared/components/visit-panel/visit-panel.component';
import { LeadDetailHeaderComponent } from './lead-detail-header.component';
import { LeadInquiryCardComponent } from './lead-inquiry-card.component';
import { TIMEOUT_MS } from '../../../core/config';

@Component({
  selector: 'app-lead-detail',
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActivityNotesComponent, AiAdvisorPanelComponent, CardComponent, ButtonComponent, ConfirmDialogComponent, ContactInfoComponent, LeadServicesCardComponent, MapPreviewComponent, VisitPanelComponent, LeadDetailHeaderComponent, LeadInquiryCardComponent, TranslatePipe],
})
export class LeadDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly userService = inject(UserService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);

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
  protected readonly activeTab = signal<'activity' | 'visit' | 'ai'>('visit');
  
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
  protected readonly sendInvite = signal(false);

  // Computed min date for schedule/reschedule (today's date as YYYY-MM-DD)
  protected readonly minDate = computed(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Computed: can send invite if lead has email
  protected readonly canSendInvite = computed(() => !!this.lead()?.consumer?.email);

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
  protected readonly serviceTypes = signal<ServiceTypeItem[]>([]);

  // AI Analysis
  protected readonly aiAnalysis = signal<LeadAIAnalysis | null>(null);
  protected readonly aiAnalysisLoading = signal(false);
  protected readonly aiAnalysisError = signal<string | null>(null);
  protected readonly aiAnalysisRefreshing = signal(false);
  protected readonly aiAnalysisIsDefault = signal(false);
  protected readonly aiAnalysisNoNewInfo = signal(false);

  // ARIA live region for announcements
  protected readonly announcement = signal<string>('');
  
  // Confirmation dialog
  protected readonly showConfirmDialog = signal(false);
  protected readonly confirmDialogTitle = signal('');
  protected readonly confirmDialogMessage = signal('');
  protected readonly pendingStatusChange = signal<LeadStatus | null>(null);

  // Services management
  protected readonly showAddServiceForm = signal(false);
  protected readonly newServiceType = signal<string | null>(null);
  protected readonly newServiceConsumerNote = signal('');
  protected readonly newServiceSource = signal('');
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

  protected readonly statusLabels = computed<Record<LeadStatus, string>>(() => ({
    New: this.translate.instant('leads.detail.status.new'),
    Attempted_Contact: this.translate.instant('leads.detail.status.contacted'),
    Scheduled: this.translate.instant('leads.detail.status.scheduled'),
    Surveyed: this.translate.instant('leads.detail.status.completed'),
    Bad_Lead: this.translate.instant('leads.detail.status.badLead'),
    Needs_Rescheduling: this.translate.instant('leads.detail.status.needsRescheduling'),
    Closed: this.translate.instant('leads.detail.status.closed'),
  }));
  protected readonly STATUS_COLORS = STATUS_COLORS;

  protected readonly serviceTypeLabels = computed<Record<string, string>>(() =>
    this.serviceTypes().reduce((acc, item) => {
      acc[item.name] = item.name;
      return acc;
    }, {} as Record<string, string>)
  );

  protected readonly serviceTypeOptions = computed(() =>
    this.serviceTypes().map(item => ({
      label: item.name,
      value: item.name,
    }))
  );

  protected readonly statusOptions = computed<SelectOption<LeadStatus>[]>(() => (
    STATUS_OPTIONS.map(option => ({
      value: option.value,
      label: this.statusLabels()[option.value],
    }))
  ));
  protected readonly accessDifficultyOptions = computed<SelectOption<AccessDifficulty>[]>(() => (
    ACCESS_DIFFICULTY_OPTIONS.map(option => ({
      value: option.value,
      label: this.translate.instant(`leads.detail.accessDifficulty.${option.value.toLowerCase()}`),
    }))
  ));
  protected readonly canAssign = computed(() => {
    const currentUser = this.user();
    const lead = this.lead();
    if (!currentUser || !lead) return false;
    if (currentUser.roles?.includes('admin')) return true;
    return lead.assignedAgentId === currentUser.id;
  });

  protected readonly headerStatusLabels = computed<Record<LeadStatus, string>>(() => this.statusLabels());

  protected readonly headerServiceTypeLabel = computed(() => {
    const service = this.selectedService();
    if (!service) return null;
    return this.serviceTypeLabels()[service.serviceType] ?? service.serviceType;
  });

  protected readonly headerStatusLabel = computed(() => {
    const service = this.selectedService();
    if (!service) return this.translate.instant('leads.detail.status.noService');
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
        user: this.translate.instant('leads.detail.activity.system'),
        message: this.translate.instant('leads.detail.activity.leadCreated'),
      });
      if (lead.updatedAt && lead.updatedAt !== lead.createdAt) {
        entries.push({
          id: `updated-${lead.id}`,
          type: 'audit',
          timestamp: lead.updatedAt,
          user: this.translate.instant('leads.detail.activity.system'),
          message: this.translate.instant('leads.detail.activity.leadUpdated'),
        });
      }
      if (lead.viewedAt) {
        entries.push({
          id: `viewed-${lead.id}`,
          type: 'audit',
          timestamp: lead.viewedAt,
          user: this.translate.instant('leads.detail.activity.system'),
          message: this.translate.instant('leads.detail.activity.leadViewed'),
        });
      }
      if (lead.currentService?.visit?.scheduledDate) {
        entries.push({
          id: `scheduled-${lead.id}`,
          type: 'audit',
          timestamp: this.getScheduledEventTimestamp(lead) ?? lead.currentService.visit.scheduledDate,
          user: this.translate.instant('leads.detail.activity.system'),
          message: this.translate.instant('leads.detail.activity.visitScheduled'),
        });
      }
      if (lead.currentService?.visit?.completedAt) {
        entries.push({
          id: `completed-${lead.id}`,
          type: 'audit',
          timestamp: lead.currentService.visit.completedAt,
          user: this.translate.instant('leads.detail.activity.system'),
          message: this.translate.instant('leads.detail.activity.visitCompleted'),
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

  // Track which service ID we have analysis loaded for
  private loadedAnalysisServiceId: string | null = null;

  constructor() {
    // Effect to reload AI analysis when selected service changes
    effect(() => {
      const lead = this.lead();
      const service = this.selectedService();
      if (!lead || !service) return;

      // Only reload if service changed
      if (this.loadedAnalysisServiceId !== service.id) {
        this.loadAIAnalysis(lead.id, service.id);
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.loadProfile();
      this.loadUsers();
      this.loadServiceTypes();
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
        // AI Analysis is loaded automatically by effect when selectedService changes
        // Mark as viewed
        this.leadsService.markViewed(id).subscribe();
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.loadLead'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private loadProfile(): void {
    this.userService.getProfile().subscribe({
      next: profile => this.user.set(profile),
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.loadProfile'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadUsers(): void {
    this.userService.listUsers().subscribe({
      next: users => {
        const options = [
          { label: this.translate.instant('leads.detail.unassigned'), value: null },
          ...users.map(user => ({
            label: user.roles.length ? `${user.email} (${user.roles.join(', ')})` : user.email,
            value: user.id,
          })),
        ];
        this.assigneeOptions.set(options);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.loadUsers'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadServiceTypes(): void {
    this.serviceTypesService.listActive().subscribe({
      next: (response) => {
        const items = response.items ?? [];
        this.serviceTypes.set(items);
        if (!this.newServiceType() && items.length > 0) {
          this.newServiceType.set(items[0].name);
        }
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.loadServiceTypes'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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

  protected formatHumanDateTime = (dateStr: string | undefined): string => {
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
      return this.translate.instant('leads.detail.datetime.todayAt', { time: timeLabel });
    }
    // Check if date is yesterday
    if (date >= startOfYesterday && date < startOfToday) {
      return this.translate.instant('leads.detail.datetime.yesterdayAt', { time: timeLabel });
    }

    // For other dates, show full date with time
    const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return this.translate.instant('leads.detail.datetime.at', { date: dateLabel, time: timeLabel });
  };

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
      this.confirmDialogTitle.set(this.translate.instant('leads.detail.confirm.changeTo', { status: this.getStatusLabel(status) }));
      this.confirmDialogMessage.set(this.getConfirmMessage(status));
      this.showConfirmDialog.set(true);
      return;
    }
    
    this.newStatus.set(status);
    this.updateStatus(status);
  }

  private getConfirmMessage(status: LeadStatus): string {
    if (status === 'Bad_Lead') {
      return this.translate.instant('leads.detail.confirm.badLead');
    }
    if (status === 'Closed') {
      return this.translate.instant('leads.detail.confirm.closed');
    }
    return this.translate.instant('leads.detail.confirm.default');
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
        setTimeout(() => this.copiedAddress.set(false), TIMEOUT_MS.feedbackClear);
      });
      return;
    }
    this.copiedAddress.set(true);
    setTimeout(() => this.copiedAddress.set(false), TIMEOUT_MS.feedbackClear);
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
        this.announce(this.translate.instant('leads.detail.announcements.statusChanged', { status: this.getStatusLabel(status) }));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.updateStatus'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.assignLead'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected scheduleVisit(): void {
    const lead = this.lead();
    const service = this.selectedService();
    if (!lead || !service || !this.scheduledDate() || !this.scheduledTime()) return;

    const scheduledDate = new Date(`${this.scheduledDate()}T${this.scheduledTime()}`).toISOString();
    
    this.saving.set(true);
    this.leadsService.scheduleVisit(lead.id, {
      serviceId: service.id,
      scheduledDate,
      scoutId: this.selectedScout() ?? undefined,
      sendInvite: this.sendInvite() || undefined,
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showScheduleForm.set(false);
        this.scheduledDate.set('');
        this.scheduledTime.set('');
        this.sendInvite.set(false);
        this.saving.set(false);
        this.announce(this.translate.instant('leads.detail.announcements.visitScheduled'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.scheduleVisit'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected completeSurvey(): void {
    const lead = this.lead();
    const service = this.selectedService();
    const difficulty = this.accessDifficulty();
    if (!lead || !service || !this.measurements() || !difficulty) return;

    this.saving.set(true);
    this.leadsService.completeSurvey(lead.id, {
      serviceId: service.id,
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
        this.announce(
          this.isEditingVisit()
            ? this.translate.instant('leads.detail.announcements.visitUpdated')
            : this.translate.instant('leads.detail.announcements.visitCompleted')
        );
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.completeSurvey'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected editVisit(): void {
    const lead = this.lead();
    const service = this.selectedService();
    const visit = service?.visit;
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
    const service = this.selectedService();
    if (!lead || !service) return;

    this.saving.set(true);
    this.leadsService.markNoShow(lead.id, {
      serviceId: service.id,
      notes: this.translate.instant('leads.detail.customerNotHome'),
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.saving.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.markNoShow'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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
    const service = this.selectedService();
    if (!lead || !service || !this.rescheduleDate() || !this.rescheduleTime()) return;

    const scheduledDate = new Date(`${this.rescheduleDate()}T${this.rescheduleTime()}`).toISOString();

    this.saving.set(true);
    this.leadsService.rescheduleVisit(lead.id, {
      serviceId: service.id,
      scheduledDate,
      scoutId: this.selectedScout() ?? undefined,
      noShowNotes: this.noShowNotes() || undefined,
      markAsNoShow: this.markAsNoShow(),
      sendInvite: this.sendInvite() || undefined,
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showRescheduleForm.set(false);
        this.rescheduleDate.set('');
        this.rescheduleTime.set('');
        this.noShowNotes.set('');
        this.markAsNoShow.set(false);
        this.sendInvite.set(false);
        this.saving.set(false);
        this.loadVisitHistory(lead.id);
        this.announce(this.translate.instant('leads.detail.announcements.visitRescheduled'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.rescheduleVisit'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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
        this.announce(this.translate.instant('leads.detail.announcements.noteAdded'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.addNote'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.loadNotes'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadVisitHistory(id: string): void {
    this.leadsService.listVisitHistory(id).subscribe({
      next: (response) => {
        this.visitHistory.set(response.items || []);
      },
      error: (err) => {
        this.reporter.report(err, {
          source: 'http',
          silent: true,
          userMessage: this.translate.instant('leads.detail.errors.loadVisitHistory'),
        });
      },
    });
  }

  private loadAIAnalysis(leadId: string, serviceId: string): void {
    this.loadedAnalysisServiceId = serviceId;
    this.aiAnalysisLoading.set(true);
    this.aiAnalysisError.set(null);
    this.leadsService.getLatestAnalysis(leadId, serviceId).subscribe({
      next: (response) => {
        this.aiAnalysis.set(response.analysis);
        this.aiAnalysisIsDefault.set(response.isDefault);
        this.aiAnalysisLoading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.loadAIAnalysis'));
        this.aiAnalysisError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.aiAnalysisLoading.set(false);
      },
    });
  }

  protected refreshAIAnalysis(force = false): void {
    const lead = this.lead();
    const service = this.selectedService();
    if (!lead || !service) return;

    this.aiAnalysisRefreshing.set(true);
    this.aiAnalysisError.set(null);
    this.aiAnalysisNoNewInfo.set(false);
    this.leadsService.analyzeWithAI(lead.id, service.id, force).subscribe({
      next: (response) => {
        if (response.status === 'error') {
          this.aiAnalysisError.set(response.message);
          this.reporter.report(new Error(response.message), { source: 'manual', silent: true, userMessage: response.message });
        } else if (response.analysis) {
          this.aiAnalysis.set(response.analysis);
          this.aiAnalysisIsDefault.set(false);
          if (response.status === 'no_change') {
            this.aiAnalysisNoNewInfo.set(true);
            this.announce(this.translate.instant('leads.detail.announcements.aiNoNewInfo'));
          } else {
            this.aiAnalysisNoNewInfo.set(false);
            this.announce(this.translate.instant('leads.detail.announcements.aiUpdated'));
          }
        } else {
          const message = this.translate.instant('leads.detail.errors.unexpectedResponse');
          this.aiAnalysisError.set(message);
          this.reporter.report(new Error(message), { source: 'manual', silent: true, userMessage: message });
        }
        this.aiAnalysisRefreshing.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.analyzeLead'));
        this.aiAnalysisError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.aiAnalysisRefreshing.set(false);
      },
    });
  }

  protected forceRefreshAIAnalysis(): void {
    this.refreshAIAnalysis(true);
  }

  protected onPhotosSelected(files: FileList | null): void {
    if (!files) return;
    this.surveyPhotos.set(Array.from(files));
  }

  protected getUserLabelById = (id: string | null | undefined): string => {
    if (!id) return 'Unassigned';
    const match = this.assigneeOptions().find(option => option.value === id);
    return match?.label ?? this.translate.instant('leads.detail.unassigned');
  };

  protected getOutcomeLabel = (outcome: string): string => {
    const labels: Record<string, string> = {
      completed: this.translate.instant('leads.detail.outcome.completed'),
      no_show: this.translate.instant('leads.detail.outcome.noShow'),
      rescheduled: this.translate.instant('leads.detail.outcome.rescheduled'),
      cancelled: this.translate.instant('leads.detail.outcome.cancelled'),
    };
    return labels[outcome] ?? outcome;
  };

  protected getOutcomeColor = (outcome: string): string => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      no_show: 'bg-red-100 text-red-800',
      rescheduled: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-zinc-100 text-zinc-600',
    };
    return colors[outcome] ?? 'bg-zinc-100 text-zinc-600';
  };

  // Services management methods
  protected openAddServiceForm(): void {
    this.showAddServiceForm.set(true);
    this.newServiceType.set(null);
    this.newServiceConsumerNote.set('');
    this.newServiceSource.set('');
    this.closeCurrentService.set(true);
  }

  protected cancelAddService(): void {
    this.showAddServiceForm.set(false);
    this.newServiceType.set(null);
    this.newServiceConsumerNote.set('');
    this.newServiceSource.set('');
  }

  protected addService(): void {
    const lead = this.lead();
    const serviceType = this.newServiceType();
    if (!lead || !serviceType) return;

    this.saving.set(true);
    this.leadsService.addService(lead.id, {
      serviceType,
      closeCurrentStatus: this.closeCurrentService(),
      consumerNote: this.newServiceConsumerNote() || undefined,
      source: this.newServiceSource() || undefined,
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showAddServiceForm.set(false);
        this.newServiceType.set(null);
        this.newServiceConsumerNote.set('');
        this.newServiceSource.set('');
        this.saving.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.addService'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.errors.updateServiceStatus'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const nested = (error as { error?: { error?: string } | string }).error;
      if (typeof nested === 'string') return nested;
      if (nested && typeof nested === 'object' && 'error' in nested && typeof nested.error === 'string') {
        return nested.error;
      }
    }
    return fallback;
  }

  // Announce messages for screen readers
  private announce(message: string): void {
    this.announcement.set(message);
    setTimeout(() => this.announcement.set(''), TIMEOUT_MS.announcementClear);
  }
}

interface ActivityEntry {
  id: string;
  type: 'audit' | LeadNoteType;
  timestamp: string;
  user: string;
  message: string;
}
