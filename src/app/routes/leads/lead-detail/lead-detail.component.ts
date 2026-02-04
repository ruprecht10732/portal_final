import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { LeadsService } from '../../../core/services/leads.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import type { Lead, LeadAIAnalysis, LeadNote, LeadNoteType, LeadService, LeadServiceAttachment, LeadStatus, LogCallResponse, PhotoAnalysis } from '../../../core/services/leads.types';
import { STATUS_COLORS, STATUS_LABELS, STATUS_OPTIONS } from '../../../core/services/leads.types';
import type {
  AccessDifficulty,
  AppointmentAttachmentResponse,
  AppointmentResponse,
  AppointmentVisitReportResponse,
  CreateAppointmentAttachmentRequest,
  CreateAppointmentRequest,
  UpsertVisitReportRequest,
} from '../../../core/services/appointments.types';
import { ACCESS_DIFFICULTY_OPTIONS } from '../../../core/services/appointments.types';
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
import type { ChipVariant } from '../../../shared/components/chip/chip.component';
import { FileUploaderComponent, type FileUploadError, type PresignedUpload } from '../../../shared/components/file-uploader/file-uploader.component';
import { LeadEnergyLabelCardComponent } from './lead-energy-label-card.component';
import { LeadEnrichmentCardComponent } from './lead-enrichment-card.component';
import { LeadDetailHeaderComponent } from './lead-detail-header.component';
import { LeadInquiryCardComponent } from './lead-inquiry-card.component';
import { CallLoggerDialogComponent, type CallLoggerSubmitEvent } from '../../../shared/components/call-logger-dialog';
import { TIMEOUT_MS } from '../../../core/config';

@Component({
  selector: 'app-lead-detail',
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActivityNotesComponent, AiAdvisorPanelComponent, CallLoggerDialogComponent, CardComponent, ButtonComponent, ConfirmDialogComponent, ContactInfoComponent, LeadServicesCardComponent, MapPreviewComponent, LeadEnergyLabelCardComponent, LeadEnrichmentCardComponent, LeadDetailHeaderComponent, LeadInquiryCardComponent, FileUploaderComponent, TranslatePipe],
})
export class LeadDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);
  private readonly appointmentsService = inject(AppointmentsService);
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

  // Status change
  protected readonly newStatus = signal<LeadStatus | null>(null);

  protected readonly statusMenuOpen = signal(false);
  protected readonly activeTab = signal<'activity' | 'appointments' | 'ai' | 'files'>('activity');

  protected readonly appointments = signal<AppointmentResponse[]>([]);
  protected readonly appointmentsLoading = signal(false);
  protected readonly appointmentsError = signal<string | null>(null);
  protected readonly showAppointmentForm = signal(false);
  protected readonly appointmentSaving = signal(false);
  protected readonly appointmentDate = signal('');
  protected readonly appointmentTime = signal('');
  protected readonly appointmentDurationMinutes = signal('60');
  protected readonly appointmentTitle = signal('');
  protected readonly appointmentLocation = signal('');
  protected readonly appointmentNotes = signal('');
  protected readonly selectedAppointmentId = signal<string | null>(null);

  protected readonly visitReport = signal<AppointmentVisitReportResponse | null>(null);
  protected readonly reportMeasurements = signal('');
  protected readonly reportAccessDifficulty = signal<AccessDifficulty | null>(null);
  protected readonly reportNotes = signal('');
  protected readonly reportSaving = signal(false);
  protected readonly reportLoading = signal(false);

  protected readonly attachments = signal<AppointmentAttachmentResponse[]>([]);
  protected readonly attachmentsLoading = signal(false);
  protected readonly attachmentSaving = signal(false);
  protected readonly attachmentFileKey = signal('');
  protected readonly attachmentFileName = signal('');
  protected readonly attachmentContentType = signal('');
  protected readonly attachmentSizeBytes = signal('');

  // Service attachments (per lead service)
  protected readonly serviceAttachments = signal<LeadServiceAttachment[]>([]);
  protected readonly serviceAttachmentsLoading = signal(false);
  protected readonly serviceAttachmentDeleting = signal<string | null>(null);
  protected readonly serviceAttachmentError = signal<string | null>(null);
  protected readonly serviceAttachmentUploading = signal(false);

  protected readonly noteText = signal('');
  protected readonly noteType = signal<LeadNoteType>('note');
  protected readonly leadNotes = signal<LeadNote[]>([]);
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
  protected readonly missingInformation = computed(() => this.aiAnalysis()?.missingInformation ?? []);

  // Photo Analysis
  protected readonly photoAnalysis = signal<PhotoAnalysis | null>(null);
  protected readonly photoAnalysisLoading = signal(false);

  // ARIA live region for announcements
  protected readonly announcement = signal<string>('');
  
  // Confirmation dialog
  protected readonly showConfirmDialog = signal(false);
  protected readonly confirmDialogTitle = signal('');
  protected readonly confirmDialogMessage = signal('');
  protected readonly pendingStatusChange = signal<LeadStatus | null>(null);

  // Call logger dialog
  protected readonly showCallLoggerDialog = signal(false);
  protected readonly callLoggerProcessing = signal(false);
  protected readonly callLoggerResult = signal<LogCallResponse | null>(null);

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

  protected readonly energyLabel = computed(() => this.lead()?.energyLabel ?? null);
  protected readonly leadEnrichment = computed(() => this.lead()?.leadEnrichment ?? null);
  protected readonly leadScore = computed(() => this.lead()?.leadScore ?? null);
  protected readonly energyLabelClass = computed<string | null>(() => this.energyLabel()?.energieklasse ?? null);
  protected readonly energyLabelVariant = computed<ChipVariant>(() => {
    const label = this.energyLabelClass();
    if (!label) return 'neutral';
    const normalized = label.toUpperCase();
    if (normalized.startsWith('A') || normalized.startsWith('B')) {
      return 'success';
    }
    if (normalized.startsWith('C')) {
      return 'info';
    }
    if (normalized.startsWith('D')) {
      return 'warning';
    }
    return 'danger';
  });

  protected readonly accessDifficultyOptions = computed<SelectOption<AccessDifficulty>[]>(() => (
    ACCESS_DIFFICULTY_OPTIONS.map(option => ({
      value: option.value,
      label: option.label,
    }))
  ));

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

  protected readonly canSaveAppointment = computed(() => {
    return !!this.appointmentDate().trim() && !!this.appointmentTime().trim() && !this.appointmentSaving();
  });

  protected readonly canEditReport = computed(() => {
    const appointment = this.selectedAppointment();
    return !!appointment && !this.reportSaving();
  });

  protected readonly canAddAttachment = computed(() => {
    return !!this.attachmentFileKey().trim() && !!this.attachmentFileName().trim() && !this.attachmentSaving();
  });

  protected readonly selectedAppointment = computed(() => {
    const id = this.selectedAppointmentId();
    if (!id) return null;
    return this.appointments().find(item => item.id === id) ?? null;
  });

  protected readonly minDate = computed(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
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

    // Effect to reload service attachments when selected service changes and Files tab is active
    effect(() => {
      const service = this.selectedService();
      const tab = this.activeTab();
      if (tab === 'files' && service) {
        this.loadServiceAttachments();
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
        this.loading.set(false);
        this.loadNotes(lead.id);
        this.loadAppointments(lead.id);
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
      if (this.showCallLoggerDialog() && !this.callLoggerProcessing()) {
        this.closeCallLogger();
        return;
      }
      if (this.showConfirmDialog()) {
        this.cancelConfirmDialog();
        return;
      }
      if (this.statusMenuOpen()) {
        this.closeStatusMenu();
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
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
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

  protected openCallLogger(): void {
    this.callLoggerResult.set(null);
    this.showCallLoggerDialog.set(true);
  }

  protected closeCallLogger(): void {
    this.showCallLoggerDialog.set(false);
    this.callLoggerResult.set(null);
  }

  protected submitCallLogger(event: CallLoggerSubmitEvent): void {
    const lead = this.lead();
    const service = this.selectedService();
    if (!lead || !service) return;

    this.callLoggerProcessing.set(true);
    this.leadsService.logCall(lead.id, service.id, { 
      summary: event.summary,
      sendConfirmationEmail: event.sendConfirmationEmail,
    }).subscribe({
      next: (response) => {
        this.callLoggerResult.set(response);
        this.callLoggerProcessing.set(false);
        // Reload data to reflect changes
        this.loadLead(lead.id);
        this.announce(this.translate.instant('leads.callLogger.announcements.processed'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.callLogger.errors.process'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.callLoggerProcessing.set(false);
        this.showCallLoggerDialog.set(false);
      },
    });
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

  protected goBack(): void {
    this.router.navigate(['/app/leads']);
  }

  protected createQuote(): void {
    const lead = this.lead();
    if (!lead) return;
    this.router.navigate(['/app/offertes/new'], { queryParams: { leadId: lead.id } });
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

    // Also load photo analysis
    this.loadPhotoAnalysis(leadId, serviceId);
  }

  private loadPhotoAnalysis(leadId: string, serviceId: string): void {
    this.photoAnalysisLoading.set(true);
    this.leadsService.getPhotoAnalysis(leadId, serviceId).subscribe({
      next: (response) => {
        this.photoAnalysis.set(response.analysis);
        this.photoAnalysisLoading.set(false);
      },
      error: () => {
        // Photo analysis is optional, don't show error
        this.photoAnalysis.set(null);
        this.photoAnalysisLoading.set(false);
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
            // Reload photo analysis as it may have been updated during AI analysis
            this.loadPhotoAnalysis(lead.id, service.id);
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

  protected getUserLabelById = (id: string | null | undefined): string => {
    if (!id) return 'Unassigned';
    const match = this.assigneeOptions().find(option => option.value === id);
    return match?.label ?? this.translate.instant('leads.detail.unassigned');
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
    if (previousId !== service.id) {
      this.selectedAppointmentId.set(null);
      this.visitReport.set(null);
      this.attachments.set([]);
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

  protected toggleAppointmentForm(): void {
    this.showAppointmentForm.update(open => !open);
  }

  protected createAppointment(): void {
    const lead = this.lead();
    if (!lead || !this.canSaveAppointment()) return;

    const startTime = this.buildAppointmentStartTime();
    if (!startTime) return;

    const durationMinutes = this.parseDurationMinutes();
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);

    // Use currentService or first service for the appointment
    const leadServiceId = lead.currentService?.id ?? lead.services[0]?.id;
    if (!leadServiceId) {
      this.appointmentsError.set(this.translate.instant('leads.detail.appointments.noServiceError'));
      return;
    }

    const payload: CreateAppointmentRequest = {
      leadId: lead.id,
      leadServiceId,
      type: 'lead_visit',
      title: this.appointmentTitle().trim() || this.translate.instant('leads.detail.appointments.defaultTitle'),
      description: this.appointmentNotes().trim() || undefined,
      location: this.appointmentLocation().trim() || undefined,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      allDay: false,
    };

    this.appointmentSaving.set(true);
    this.appointmentsService.create(payload).subscribe({
      next: (created) => {
        this.appointments.update(items => [created, ...items]);
        this.selectedAppointmentId.set(created.id);
        this.showAppointmentForm.set(false);
        this.resetAppointmentForm();
        this.appointmentSaving.set(false);
        this.loadAppointmentDetails(created.id);
        this.announce(this.translate.instant('leads.detail.appointments.created'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.appointments.createError'));
        this.appointmentsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.appointmentSaving.set(false);
      },
    });
  }

  protected selectAppointment(appointmentId: string): void {
    if (appointmentId === this.selectedAppointmentId()) return;
    this.selectedAppointmentId.set(appointmentId);
    this.loadAppointmentDetails(appointmentId);
  }

  protected saveVisitReport(): void {
    const appointment = this.selectedAppointment();
    if (!appointment || !this.canEditReport()) return;

    const payload: UpsertVisitReportRequest = {
      measurements: this.reportMeasurements().trim() || undefined,
      accessDifficulty: this.reportAccessDifficulty() ?? undefined,
      notes: this.reportNotes().trim() || undefined,
    };

    this.reportSaving.set(true);
    this.appointmentsService.upsertVisitReport(appointment.id, payload).subscribe({
      next: (response) => {
        this.visitReport.set(response);
        this.syncReportFields(response);
        this.reportSaving.set(false);
        this.announce(this.translate.instant('leads.detail.appointments.reportSaved'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.appointments.reportError'));
        this.appointmentsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.reportSaving.set(false);
      },
    });
  }

  protected addAttachment(): void {
    const appointment = this.selectedAppointment();
    if (!appointment || !this.canAddAttachment()) return;

    const sizeBytesValue = Number(this.attachmentSizeBytes());
    const payload: CreateAppointmentAttachmentRequest = {
      fileKey: this.attachmentFileKey().trim(),
      fileName: this.attachmentFileName().trim(),
      contentType: this.attachmentContentType().trim() || undefined,
      sizeBytes: Number.isFinite(sizeBytesValue) ? sizeBytesValue : undefined,
    };

    this.attachmentSaving.set(true);
    this.appointmentsService.createAttachment(appointment.id, payload).subscribe({
      next: (created) => {
        this.attachments.update(items => [created, ...items]);
        this.resetAttachmentForm();
        this.attachmentSaving.set(false);
        this.announce(this.translate.instant('leads.detail.appointments.attachmentSaved'));
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.appointments.attachmentError'));
        this.appointmentsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.attachmentSaving.set(false);
      },
    });
  }

  private loadAppointments(leadId: string): void {
    this.appointmentsLoading.set(true);
    this.appointmentsError.set(null);
    this.appointmentsService.list({ leadId, type: 'lead_visit' }).subscribe({
      next: (response) => {
        const items = response.items ?? [];
        this.appointments.set(items);
        this.appointmentsLoading.set(false);
        if (!this.selectedAppointmentId() && items.length > 0) {
          this.selectedAppointmentId.set(items[0].id);
          this.loadAppointmentDetails(items[0].id);
        }
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.appointments.loadError'));
        this.appointmentsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.appointmentsLoading.set(false);
      },
    });
  }

  private loadAppointmentDetails(appointmentId: string): void {
    this.loadVisitReport(appointmentId);
    this.loadAttachments(appointmentId);
  }

  private loadVisitReport(appointmentId: string): void {
    this.reportLoading.set(true);
    this.appointmentsService.getVisitReport(appointmentId).subscribe({
      next: (response) => {
        this.visitReport.set(response);
        this.syncReportFields(response);
        this.reportLoading.set(false);
      },
      error: (err) => {
        if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 404) {
          this.visitReport.set(null);
          this.clearReportFields();
          this.reportLoading.set(false);
          return;
        }
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.appointments.reportLoadError'));
        this.appointmentsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.reportLoading.set(false);
      },
    });
  }

  private loadAttachments(appointmentId: string): void {
    this.attachmentsLoading.set(true);
    this.appointmentsService.listAttachments(appointmentId).subscribe({
      next: (items) => {
        this.attachments.set(items ?? []);
        this.attachmentsLoading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('leads.detail.appointments.attachmentsLoadError'));
        this.appointmentsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.attachmentsLoading.set(false);
      },
    });
  }

  private buildAppointmentStartTime(): Date | null {
    const date = this.appointmentDate().trim();
    const time = this.appointmentTime().trim();
    if (!date || !time) return null;
    const dateTime = new Date(`${date}T${time}`);
    if (Number.isNaN(dateTime.getTime())) return null;
    return dateTime;
  }

  private parseDurationMinutes(): number {
    const duration = Number(this.appointmentDurationMinutes());
    return Number.isFinite(duration) && duration > 0 ? duration : 60;
  }

  private resetAppointmentForm(): void {
    this.appointmentDate.set('');
    this.appointmentTime.set('');
    this.appointmentDurationMinutes.set('60');
    this.appointmentTitle.set('');
    this.appointmentLocation.set('');
    this.appointmentNotes.set('');
  }

  private resetAttachmentForm(): void {
    this.attachmentFileKey.set('');
    this.attachmentFileName.set('');
    this.attachmentContentType.set('');
    this.attachmentSizeBytes.set('');
  }

  private syncReportFields(report: AppointmentVisitReportResponse | null): void {
    this.reportMeasurements.set(report?.measurements ?? '');
    this.reportAccessDifficulty.set(report?.accessDifficulty ?? null);
    this.reportNotes.set(report?.notes ?? '');
  }

  private clearReportFields(): void {
    this.reportMeasurements.set('');
    this.reportAccessDifficulty.set(null);
    this.reportNotes.set('');
  }

  protected setAccessDifficulty(value: string): void {
    this.reportAccessDifficulty.set(value ? (value as AccessDifficulty) : null);
  }

  protected setAppointmentDate(value: string | null | undefined): void {
    this.appointmentDate.set(value ?? '');
  }

  protected setAppointmentTime(value: string | null | undefined): void {
    this.appointmentTime.set(value ?? '');
  }

  protected setAppointmentDurationMinutes(value: string | null | undefined): void {
    this.appointmentDurationMinutes.set(value ?? '');
  }

  protected setAppointmentTitle(value: string | null | undefined): void {
    this.appointmentTitle.set(value ?? '');
  }

  protected setAppointmentLocation(value: string | null | undefined): void {
    this.appointmentLocation.set(value ?? '');
  }

  protected setAppointmentNotes(value: string | null | undefined): void {
    this.appointmentNotes.set(value ?? '');
  }

  protected setReportMeasurements(value: string | null | undefined): void {
    this.reportMeasurements.set(value ?? '');
  }

  protected setReportNotes(value: string | null | undefined): void {
    this.reportNotes.set(value ?? '');
  }

  protected setAttachmentFileKey(value: string | null | undefined): void {
    this.attachmentFileKey.set(value ?? '');
  }

  protected setAttachmentFileName(value: string | null | undefined): void {
    this.attachmentFileName.set(value ?? '');
  }

  protected setAttachmentContentType(value: string | null | undefined): void {
    this.attachmentContentType.set(value ?? '');
  }

  protected setAttachmentSizeBytes(value: string | null | undefined): void {
    this.attachmentSizeBytes.set(value ?? '');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Service Attachments (per lead service)
  // ─────────────────────────────────────────────────────────────────────────────

  protected loadServiceAttachments(): void {
    const lead = this.lead();
    const service = this.selectedService();
    if (!lead || !service) {
      this.serviceAttachments.set([]);
      return;
    }

    this.serviceAttachmentsLoading.set(true);
    this.serviceAttachmentError.set(null);
    this.leadsService.listAttachments(lead.id, service.id).subscribe({
      next: (response) => {
        this.serviceAttachments.set(response.items ?? []);
        this.serviceAttachmentsLoading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, 'Failed to load attachments');
        this.serviceAttachmentError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.serviceAttachmentsLoading.set(false);
      },
    });
  }

  protected handleServiceAttachmentError(event: FileUploadError | null): void {
    if (!event) {
      this.serviceAttachmentError.set(null);
      return;
    }
    this.serviceAttachmentError.set(event.message);
    this.reporter.report(event.error, { source: 'http', silent: true, userMessage: event.message });
  }

  protected handleServiceAttachmentUploaded(attachment: LeadServiceAttachment): void {
    this.serviceAttachmentError.set(null);
    this.serviceAttachments.update(items => [attachment, ...items]);
    this.announce(this.translate.instant('leads.detail.files.uploaded'));
  }

  protected readonly presignServiceAttachment = async (file: File): Promise<PresignedUpload> => {
    const lead = this.lead();
    const service = this.selectedService();
    if (!lead || !service) throw new Error('Missing lead or service');
    return firstValueFrom(this.leadsService.getPresignedUploadUrl(lead.id, service.id, {
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }));
  };

  protected readonly finalizeServiceAttachment = async (file: File, presigned: PresignedUpload): Promise<LeadServiceAttachment> => {
    const lead = this.lead();
    const service = this.selectedService();
    if (!lead || !service) throw new Error('Missing lead or service');
    return firstValueFrom(this.leadsService.createAttachment(lead.id, service.id, {
      fileKey: presigned.fileKey,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }));
  };

  protected deleteServiceAttachment(attachmentId: string): void {
    const lead = this.lead();
    const service = this.selectedService();
    if (!lead || !service) return;

    this.serviceAttachmentDeleting.set(attachmentId);
    this.serviceAttachmentError.set(null);

    this.leadsService.deleteAttachment(lead.id, service.id, attachmentId).subscribe({
      next: () => {
        this.serviceAttachments.update(items => items.filter(a => a.id !== attachmentId));
        this.serviceAttachmentDeleting.set(null);
        this.announce('Attachment deleted');
      },
      error: (err) => {
        const message = this.getErrorMessage(err, 'Failed to delete attachment');
        this.serviceAttachmentError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.serviceAttachmentDeleting.set(null);
      },
    });
  }

  protected downloadServiceAttachment(attachment: LeadServiceAttachment): void {
    const lead = this.lead();
    const service = this.selectedService();
    if (!lead || !service) return;

    // If we already have a download URL (from list response), use it
    if (attachment.downloadUrl) {
      window.open(attachment.downloadUrl, '_blank');
      return;
    }

    // Otherwise, fetch a fresh presigned download URL
    this.leadsService.getAttachmentDownloadUrl(lead.id, service.id, attachment.id).subscribe({
      next: (response) => {
        window.open(response.downloadUrl, '_blank');
      },
      error: (err) => {
        const message = this.getErrorMessage(err, 'Failed to get download URL');
        this.serviceAttachmentError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  protected maxServiceAttachmentSizeBytes(): number {
    return 100 * 1024 * 1024;
  }
}

interface ActivityEntry {
  id: string;
  type: 'audit' | LeadNoteType;
  timestamp: string;
  user: string;
  message: string;
}
