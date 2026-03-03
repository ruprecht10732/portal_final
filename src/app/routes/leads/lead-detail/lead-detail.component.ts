import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, HostListener, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, finalize, firstValueFrom, forkJoin, of, switchMap } from 'rxjs';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { formatFullAddress } from '../../../core/utils/address.util';
import { LeadsService } from '../../../core/services/leads.service';
import { OrganizationService, type WorkflowEngineWorkflow } from '../../../core/services/organization.service';
import { AppointmentsService } from '../../../core/services/appointments.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import type { Lead, LeadAIAnalysis, LeadNote, LeadNoteType, LeadService, LeadServiceAttachment, LeadStatus, LogCallResponse, PhotoAnalysis, LeadTimelineItem } from '../../../core/services/leads.types';
import { ALLOWED_STATUS_TRANSITIONS, buildLeadStatusLabels, MANUAL_STATUS_OPTIONS, STATUS_COLORS, STATUS_LABELS } from '../../../core/services/leads.types';
import { PartnersService } from '../../../core/services/partners.service';
import type { OfferResponse, Partner } from '../../../core/services/partners.types';
import { QuotesService } from '../../../core/services/quotes.service';
import type { QuoteResponse } from '../../../core/services/quotes.types';
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
import { CardComponent } from '../../../shared/components/card/card.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { type SelectOption } from '../../../shared/components/select/select.component';
import type { ChipVariant } from '../../../shared/components/chip/chip.component';
import { type FileUploadError, type PresignedUpload } from '../../../shared/components/file-uploader/file-uploader.component';
import { CallLoggerDialogComponent, type CallLoggerSubmitEvent } from '../../../shared/components/call-logger-dialog';
import { type TabItem } from '../../../shared/components/tab-bar/tab-bar.component';
import { LeadDetailSkeletonComponent } from './lead-detail-skeleton.component';
import { LeadDetailAppointmentsTabComponent } from './lead-detail-appointments-tab.component';
import { LeadDetailFilesTabComponent } from './lead-detail-files-tab.component';
import { LeadDetailInfoCardsComponent } from './lead-detail-info-cards.component';
import { LeadInquiryCardComponent } from './lead-inquiry-card.component';
import { LeadDetailMobileConsumerCardComponent } from './lead-detail-mobile-consumer-card.component';
import { LeadDetailNotesPanelComponent } from './lead-detail-notes-panel.component';
import { LeadDetailPreferencesTabComponent } from './lead-detail-preferences-tab.component';
import { LeadDetailServicesPanelComponent } from './lead-detail-services-panel.component';
import { LeadDetailSidebarInfoComponent } from './lead-detail-sidebar-info.component';
import { LeadDetailTabsShellComponent } from './lead-detail-tabs-shell.component';
import { LeadDetailTopSectionComponent } from './lead-detail-top-section.component';
import { LeadDetailTimelineTabComponent } from './lead-detail-timeline-tab.component';
import { TIMEOUT_MS } from '../../../core/config';

type WhatsAppMessageStatus = 'sent' | 'draft' | 'failed';

const REPORT_SAVED_TRANSLATION_KEY = 'leads.detail.appointments.reportSaved';
const REPORT_ERROR_TRANSLATION_KEY = 'leads.detail.appointments.reportError';
const APPOINTMENT_NO_SERVICE_ERROR_TRANSLATION_KEY = 'leads.detail.appointments.noServiceError';
const APPOINTMENT_DEFAULT_TITLE_TRANSLATION_KEY = 'leads.detail.appointments.defaultTitle';
const APPOINTMENT_CREATED_TRANSLATION_KEY = 'leads.detail.appointments.created';
const APPOINTMENT_CREATE_ERROR_TRANSLATION_KEY = 'leads.detail.appointments.createError';
const APPOINTMENT_ATTACHMENT_SAVED_TRANSLATION_KEY = 'leads.detail.appointments.attachmentSaved';
const APPOINTMENT_ATTACHMENT_ERROR_TRANSLATION_KEY = 'leads.detail.appointments.attachmentError';
const APPOINTMENT_APPROVED_TRANSLATION_KEY = 'leads.detail.appointments.approved';
const APPOINTMENT_APPROVE_ERROR_TRANSLATION_KEY = 'leads.detail.appointments.approveError';
const APPOINTMENT_LOAD_ERROR_TRANSLATION_KEY = 'leads.detail.appointments.loadError';
const APPOINTMENT_REPORT_LOAD_ERROR_TRANSLATION_KEY = 'leads.detail.appointments.reportLoadError';
const APPOINTMENT_ATTACHMENTS_LOAD_ERROR_TRANSLATION_KEY = 'leads.detail.appointments.attachmentsLoadError';
const WORKFLOW_DEFAULT_OPTION_TRANSLATION_KEY = 'leads.detail.workflow.defaultOption';
const TAB_ACTIVITY_TRANSLATION_KEY = 'leads.detail.tabs.activity';
const TAB_PREFERENCES_TRANSLATION_KEY = 'leads.detail.tabs.preferences';
const TAB_APPOINTMENTS_TRANSLATION_KEY = 'leads.detail.tabs.appointments';
const TAB_TIMELINE_TRANSLATION_KEY = 'leads.detail.tabs.timeline';
const TAB_FILES_TRANSLATION_KEY = 'leads.detail.tabs.files';
const ADD_SERVICE_CONSUMER_NOTE_TOO_LONG_TRANSLATION_KEY = 'leads.detail.addService.consumerNoteTooLong';
const ACCESS_DIFFICULTY_LOW_TRANSLATION_KEY = 'appointments.accessDifficulty.low';
const ACCESS_DIFFICULTY_MEDIUM_TRANSLATION_KEY = 'appointments.accessDifficulty.medium';
const ACCESS_DIFFICULTY_HIGH_TRANSLATION_KEY = 'appointments.accessDifficulty.high';
const STATUS_NO_SERVICE_TRANSLATION_KEY = 'leads.detail.status.noService';
const ACTIVITY_SYSTEM_TRANSLATION_KEY = 'leads.detail.activity.system';
const ACTIVITY_LEAD_CREATED_TRANSLATION_KEY = 'leads.detail.activity.leadCreated';
const ACTIVITY_LEAD_UPDATED_TRANSLATION_KEY = 'leads.detail.activity.leadUpdated';
const ACTIVITY_LEAD_VIEWED_TRANSLATION_KEY = 'leads.detail.activity.leadViewed';
const ERROR_LOAD_LEAD_TRANSLATION_KEY = 'leads.detail.errors.loadLead';
const ERROR_LOAD_PROFILE_TRANSLATION_KEY = 'leads.detail.errors.loadProfile';
const UNASSIGNED_TRANSLATION_KEY = 'leads.detail.unassigned';
const ERROR_LOAD_USERS_TRANSLATION_KEY = 'leads.detail.errors.loadUsers';
const ERROR_LOAD_SERVICE_TYPES_TRANSLATION_KEY = 'leads.detail.errors.loadServiceTypes';
const DATETIME_TODAY_AT_TRANSLATION_KEY = 'leads.detail.datetime.todayAt';
const DATETIME_YESTERDAY_AT_TRANSLATION_KEY = 'leads.detail.datetime.yesterdayAt';
const DATETIME_AT_TRANSLATION_KEY = 'leads.detail.datetime.at';
const CONFIRM_CHANGE_TO_TRANSLATION_KEY = 'leads.detail.confirm.changeTo';
const CONFIRM_DISQUALIFIED_TRANSLATION_KEY = 'leads.detail.confirm.disqualified';
const CONFIRM_DEFAULT_TRANSLATION_KEY = 'leads.detail.confirm.default';
const CALL_LOGGER_PROCESSED_TRANSLATION_KEY = 'leads.callLogger.announcements.processed';
const CALL_LOGGER_PROCESS_ERROR_TRANSLATION_KEY = 'leads.callLogger.errors.process';
const ANNOUNCEMENT_STATUS_CHANGED_TRANSLATION_KEY = 'leads.detail.announcements.statusChanged';
const ERROR_UPDATE_STATUS_TRANSLATION_KEY = 'leads.detail.errors.updateStatus';
const ERROR_ASSIGN_LEAD_TRANSLATION_KEY = 'leads.detail.errors.assignLead';
const ANNOUNCEMENT_NOTE_ADDED_TRANSLATION_KEY = 'leads.detail.announcements.noteAdded';
const ERROR_ADD_NOTE_TRANSLATION_KEY = 'leads.detail.errors.addNote';
const ERROR_LOAD_NOTES_TRANSLATION_KEY = 'leads.detail.errors.loadNotes';
const ERROR_LOAD_TIMELINE_TRANSLATION_KEY = 'leads.detail.errors.loadTimeline';
const ERROR_LOAD_AI_ANALYSIS_TRANSLATION_KEY = 'leads.detail.errors.loadAIAnalysis';
const ANNOUNCEMENT_AI_NO_NEW_INFO_TRANSLATION_KEY = 'leads.detail.announcements.aiNoNewInfo';
const ANNOUNCEMENT_AI_UPDATED_TRANSLATION_KEY = 'leads.detail.announcements.aiUpdated';
const ERROR_UNEXPECTED_RESPONSE_TRANSLATION_KEY = 'leads.detail.errors.unexpectedResponse';
const ERROR_ANALYZE_LEAD_TRANSLATION_KEY = 'leads.detail.errors.analyzeLead';
const TIMELINE_MESSAGE_COPIED_TRANSLATION_KEY = 'leads.detail.timeline.messageCopied';
const ERROR_ADD_SERVICE_TRANSLATION_KEY = 'leads.detail.errors.addService';
const ERROR_UPDATE_SERVICE_STATUS_TRANSLATION_KEY = 'leads.detail.errors.updateServiceStatus';
const WORKFLOW_SAVED_TRANSLATION_KEY = 'leads.detail.workflow.saved';
const WORKFLOW_SAVE_FAILED_TRANSLATION_KEY = 'leads.detail.workflow.saveFailed';
const WORKFLOW_CLEARED_TRANSLATION_KEY = 'leads.detail.workflow.cleared';
const WORKFLOW_CLEAR_FAILED_TRANSLATION_KEY = 'leads.detail.workflow.clearFailed';
const WORKFLOW_LOAD_FAILED_TRANSLATION_KEY = 'leads.detail.workflow.loadFailed';
const FILES_UPLOADED_TRANSLATION_KEY = 'leads.detail.files.uploaded';

interface TimelineContactMessage {
  channel: 'WhatsApp' | 'Email';
  message: string;
  status?: WhatsAppMessageStatus;
  phone?: string;
}

@Component({
  selector: 'app-lead-detail',
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CallLoggerDialogComponent, CardComponent, ConfirmDialogComponent, LeadDetailSkeletonComponent, LeadDetailAppointmentsTabComponent, LeadDetailFilesTabComponent, LeadDetailInfoCardsComponent, LeadDetailMobileConsumerCardComponent, LeadDetailNotesPanelComponent, LeadDetailPreferencesTabComponent, LeadDetailServicesPanelComponent, LeadDetailSidebarInfoComponent, LeadDetailTabsShellComponent, LeadDetailTopSectionComponent, LeadDetailTimelineTabComponent, LeadInquiryCardComponent, AutocompleteComponent, NumberInputComponent, SelectComponent, TranslatePipe],
})
export class LeadDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);
  private readonly orgService = inject(OrganizationService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly userService = inject(UserService);
  private readonly partnersService = inject(PartnersService);
  private readonly quotesService = inject(QuotesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly partnerSearch$ = new Subject<string>();
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

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
  protected readonly activeTab = signal<'activity' | 'appointments' | 'timeline' | 'files' | 'preferences'>('activity');

  protected readonly workflowProfiles = signal<WorkflowEngineWorkflow[]>([]);
  protected readonly selectedLeadWorkflowId = signal<string | null>(null);
  protected readonly leadWorkflowOverrideMode = signal<'manual' | 'manual_lock' | 'clear' | null>(null);
  protected readonly leadWorkflowResolutionSource = signal<'manual_override' | 'auto_rule' | 'organization_default' | null>(null);
  protected readonly workflowSaving = signal(false);
  protected readonly workflowError = signal<string | null>(null);

  protected readonly workflowOptions = computed<SelectOption<string | null>[]>(() => [
    { value: null, label: this.translate.instant(WORKFLOW_DEFAULT_OPTION_TRANSLATION_KEY) },
    ...this.workflowProfiles().map(workflow => ({ value: workflow.id, label: workflow.name })),
  ]);
  protected readonly tabs = computed<TabItem[]>(() => {
    // Read lang to trigger recomputation on language change
    this.lang();
    return [
      { id: 'activity', label: this.translate.instant(TAB_ACTIVITY_TRANSLATION_KEY) },
      { id: 'preferences', label: this.translate.instant(TAB_PREFERENCES_TRANSLATION_KEY) },
      { id: 'appointments', label: this.translate.instant(TAB_APPOINTMENTS_TRANSLATION_KEY) },
      { id: 'timeline', label: this.translate.instant(TAB_TIMELINE_TRANSLATION_KEY) },
      { id: 'files', label: this.translate.instant(TAB_FILES_TRANSLATION_KEY) },
    ];
  });

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
  protected readonly approvingAppointmentId = signal<string | null>(null);

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
  protected readonly notePanelDesktop = viewChild<LeadDetailNotesPanelComponent>('notePanelDesktop');
  protected readonly notePanelMobile = viewChild<LeadDetailNotesPanelComponent>('notePanelMobile');
  protected readonly serviceTypes = signal<ServiceTypeItem[]>([]);

  // AI Analysis
  protected readonly aiAnalysis = signal<LeadAIAnalysis | null>(null);
  protected readonly aiAnalysisLoading = signal(false);
  protected readonly aiAnalysisError = signal<string | null>(null);
  protected readonly aiAnalysisRefreshing = signal(false);
  protected readonly aiAnalysisIsDefault = signal(false);
  protected readonly aiAnalysisNoNewInfo = signal(false);
  protected readonly missingInformation = computed(() => this.aiAnalysis()?.missingInformation ?? []);
  protected readonly callLoggerMissingInformation = computed(() => {
    const aiMissing = this.missingInformation();
    if (aiMissing.length > 0) {
      return aiMissing;
    }
    for (const item of this.timelineItems()) {
      const missing = this.getTimelineMissingInformation(item);
      if (missing.length > 0) {
        return missing;
      }
    }
    return [];
  });
  protected readonly aiInsightsMissingInformation = computed(() => this.callLoggerMissingInformation());
  
  // Create an effective AI analysis from API or timeline fallback
  protected readonly effectiveAiAnalysis = computed(() => {
    const apiAnalysis = this.aiAnalysis();
    if (apiAnalysis) {
      return apiAnalysis;
    }
    // Fallback to timeline metadata if no API analysis
    for (const item of this.timelineItems()) {
      const metadata = item.metadata;
      const action = metadata['recommendedAction'];
      const urgency = metadata['urgencyLevel'];
      if (typeof action === 'string' && typeof urgency === 'string') {
        // Found analysis data in timeline, construct a minimal analysis object
        return {
          recommendedAction: action,
          urgencyLevel: urgency,
          summary: typeof metadata['summary'] === 'string' ? metadata['summary'] : item.summary,
          missingInformation: Array.isArray(metadata['missingInformation']) ? metadata['missingInformation'] as string[] : [],
          preferredContactChannel: (metadata['preferredContactChannel'] as 'WhatsApp' | 'Email') || undefined,
          suggestedContactMessage: typeof metadata['suggestedContactMessage'] === 'string' ? metadata['suggestedContactMessage'] : undefined,
        } as LeadAIAnalysis;
      }
    }
    return null;
  });
  
  protected readonly aiInsightsAvailable = computed(() => {
    const analysis = this.effectiveAiAnalysis();
    const missing = this.aiInsightsMissingInformation();
    const score = this.leadScore();
    return Boolean(analysis) || missing.length > 0 || Boolean(score?.score) || Boolean(score?.preAi);
  });

  // Photo Analysis
  protected readonly photoAnalysis = signal<PhotoAnalysis | null>(null);
  protected readonly photoAnalysisLoading = signal(false);

  // Timeline
  protected readonly timelineItems = signal<LeadTimelineItem[]>([]);
  protected readonly timelineLoading = signal(false);
  protected readonly timelineError = signal<string | null>(null);

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

  // Add Service Consumer Note validation (max 2000 chars)
  protected readonly maxConsumerNoteLength = 2000;
  protected readonly consumerNoteLength = computed(() => this.newServiceConsumerNote().length);
  protected readonly consumerNoteTooLong = computed(() => this.consumerNoteLength() > this.maxConsumerNoteLength);
  protected readonly consumerNoteRemaining = computed(() => Math.max(0, this.maxConsumerNoteLength - this.consumerNoteLength()));
  protected readonly consumerNoteError = computed(() =>
    this.consumerNoteTooLong()
      ? this.translate.instant(ADD_SERVICE_CONSUMER_NOTE_TOO_LONG_TRANSLATION_KEY, { max: this.maxConsumerNoteLength })
      : null
  );

  // Computed selected service - uses selectedServiceId or falls back to currentService
  protected readonly selectedService = computed(() =>
    this.resolveSelectedService(this.lead(), this.selectedServiceId())
  );

  // ── Manual partner recovery (Manual Intervention) ─────────────────────────

  protected readonly showManualPartnerActions = computed(() => {
    const service = this.selectedService();
    return service?.pipelineStage === 'Manual_Intervention';
  });

  protected readonly acceptedOffer = signal<OfferResponse | null>(null);
  protected readonly acceptedOfferLoading = signal(false);
  protected readonly acceptedOfferError = signal<string | null>(null);

  protected readonly manualPartnerCardMode = computed<'manual' | 'accepted'>(() => {
    return this.acceptedOffer() ? 'accepted' : 'manual';
  });

  protected readonly acceptedQuote = signal<QuoteResponse | null>(null);
  protected readonly acceptedQuoteLoading = signal(false);
  protected readonly acceptedQuoteError = signal<string | null>(null);

  protected readonly partnerSearch = signal('');
  protected readonly partnerSearchLoading = signal(false);
  protected readonly partnerSearchError = signal<string | null>(null);
  protected readonly partnerResults = signal<Partner[]>([]);
  protected readonly selectedPartnerId = signal<string | null>(null);

  protected readonly expiresInHours = signal<number>(12);

  protected readonly offerCreating = signal(false);
  protected readonly offerError = signal<string | null>(null);
  protected readonly createdOfferToken = signal<string | null>(null);
  protected readonly createdOfferVakmanPriceCents = signal<number | null>(null);

  protected readonly selectedPartner = computed(() => {
    const id = this.selectedPartnerId();
    if (!id) return null;
    return this.partnerResults().find(p => p.id === id) ?? null;
  });

  protected readonly partnerOptions = computed<AutocompleteOption[]>(() =>
    (this.partnerResults() ?? []).map(p => ({ value: p.id, label: `${p.businessName} — ${p.city}` }))
  );

  protected readonly offerAcceptanceUrl = computed(() => {
    const token = this.createdOfferToken();
    if (!token) return null;
    return this.partnersService.buildOfferAcceptanceUrl(token);
  });

  protected readonly canCreateOffer = computed(() => {
    if (this.offerCreating()) return false;
    if (!this.selectedPartnerId()) return false;
    const quote = this.acceptedQuote();
    if (!quote) return false;
    return quote.totalCents > 0;
  });

  protected readonly statusLabels = computed<Record<LeadStatus, string>>(() => {
    this.lang();
    return buildLeadStatusLabels((key) => this.translate.instant(key));
  });
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

  protected readonly accessDifficultyOptions = computed<SelectOption<AccessDifficulty>[]>(() => {
    this.lang();
    const labels: Record<AccessDifficulty, string> = {
      Low: this.translate.instant(ACCESS_DIFFICULTY_LOW_TRANSLATION_KEY),
      Medium: this.translate.instant(ACCESS_DIFFICULTY_MEDIUM_TRANSLATION_KEY),
      High: this.translate.instant(ACCESS_DIFFICULTY_HIGH_TRANSLATION_KEY),
    };
    return ACCESS_DIFFICULTY_OPTIONS.map(option => ({
      value: option.value,
      label: labels[option.value] ?? option.label,
    }));
  });

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

  protected readonly statusOptions = computed<SelectOption<LeadStatus>[]>(() => {
    const currentStatus = this.lead()?.currentService?.status;
    const allowed = currentStatus ? ALLOWED_STATUS_TRANSITIONS[currentStatus] : [];
    return MANUAL_STATUS_OPTIONS
      .filter(option => allowed.includes(option.value))
      .map(option => ({
        value: option.value,
        label: this.statusLabels()[option.value],
      }));
  });
  protected readonly canAssign = computed(() => {
    const currentUser = this.user();
    const lead = this.lead();
    if (!currentUser || !lead) return false;
    if (currentUser.roles?.includes('admin')) return true;
    return lead.assignedAgentId === currentUser.id;
  });

  protected readonly headerStatusLabels = computed<Record<LeadStatus, string>>(() => this.statusLabels());

  protected readonly headerNoServiceLabel = computed(() => {
    this.lang();
    return this.translate.instant(STATUS_NO_SERVICE_TRANSLATION_KEY);
  });

  protected readonly headerServiceTypeLabel = computed(() => {
    const service = this.selectedService();
    if (!service) return null;
    return this.serviceTypeLabels()[service.serviceType] ?? service.serviceType;
  });

  private resolveSelectedService(lead: Lead | null, selectedId: string | null): LeadService | null {
    if (!lead) return null;
    const selected = selectedId ? lead.services.find(service => service.id === selectedId) : null;
    return selected ?? lead.currentService ?? null;
  }


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
        user: this.translate.instant(ACTIVITY_SYSTEM_TRANSLATION_KEY),
        message: this.translate.instant(ACTIVITY_LEAD_CREATED_TRANSLATION_KEY),
      });
      if (lead.updatedAt && lead.updatedAt !== lead.createdAt) {
        entries.push({
          id: `updated-${lead.id}`,
          type: 'audit',
          timestamp: lead.updatedAt,
          user: this.translate.instant(ACTIVITY_SYSTEM_TRANSLATION_KEY),
          message: this.translate.instant(ACTIVITY_LEAD_UPDATED_TRANSLATION_KEY),
        });
      }
      if (lead.viewedAt) {
        entries.push({
          id: `viewed-${lead.id}`,
          type: 'audit',
          timestamp: lead.viewedAt,
          user: this.translate.instant(ACTIVITY_SYSTEM_TRANSLATION_KEY),
          message: this.translate.instant(ACTIVITY_LEAD_VIEWED_TRANSLATION_KEY),
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
    return today.toISOString().split('T')[0] ?? '';
  });

  // Track which service ID we have analysis loaded for
  private loadedAnalysisServiceId: string | null = null;

  constructor() {
    this.partnerSearch$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
        switchMap((query) => {
          const trimmed = query.trim();
          if (trimmed.length < 2) {
            this.partnerResults.set([]);
            this.partnerSearchLoading.set(false);
            this.partnerSearchError.set(null);
            return EMPTY;
          }

          this.partnerSearchLoading.set(true);
          this.partnerSearchError.set(null);
          return this.partnersService.list({ search: trimmed, page: 1, pageSize: 10, sortBy: 'businessName', sortOrder: 'asc' });
        }),
      )
      .subscribe({
        next: (response) => {
          this.partnerResults.set(response.items ?? []);
          this.partnerSearchLoading.set(false);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('leads.detail.manualPartner.errors.searchPartners'));
          this.partnerSearchError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.partnerSearchLoading.set(false);
        },
      });

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

    // Effect to load Accepted quote for the selected service when manual intervention is active.
    effect(() => {
      const lead = this.lead();
      const service = this.selectedService();

      this.acceptedQuote.set(null);
      this.acceptedQuoteError.set(null);
      this.createdOfferToken.set(null);
      this.createdOfferVakmanPriceCents.set(null);
      this.offerError.set(null);

      if (!lead || !service) return;
      if (service.pipelineStage !== 'Manual_Intervention') return;

      this.loadAcceptedQuoteForService(lead.id, service.id);
    });

    // Effect to detect if a partner offer is already accepted for this service.
    // This prevents showing the "no partners found" manual-action UI when the offer is actually accepted.
    effect(() => {
      const service = this.selectedService();

      this.acceptedOffer.set(null);
      this.acceptedOfferError.set(null);
      this.acceptedOfferLoading.set(false);

      if (!service) return;
      if (service.pipelineStage !== 'Manual_Intervention') return;

      this.loadAcceptedOfferForService(service.id);
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
        this.loadTimeline(lead.id, this.selectedService()?.id);
        this.loadLeadWorkflowData(lead.id);
        // AI Analysis is loaded automatically by effect when selectedService changes
        // Mark as viewed
        this.leadsService.markViewed(id).subscribe();
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(ERROR_LOAD_LEAD_TRANSLATION_KEY));
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
        const message = extractErrorMessage(err, this.translate.instant(ERROR_LOAD_PROFILE_TRANSLATION_KEY));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadUsers(): void {
    this.userService.listUsers().subscribe({
      next: users => {
        const options = [
          { label: this.translate.instant(UNASSIGNED_TRANSLATION_KEY), value: null },
          ...users.map(user => ({
            label: user.roles.length ? `${user.email} (${user.roles.join(', ')})` : user.email,
            value: user.id,
          })),
        ];
        this.assigneeOptions.set(options);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(ERROR_LOAD_USERS_TRANSLATION_KEY));
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
        const firstItem = items[0];
        if (!this.newServiceType() && firstItem) {
          this.newServiceType.set(firstItem.name);
        }
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(ERROR_LOAD_SERVICE_TYPES_TRANSLATION_KEY));
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
    return formatFullAddress({
      street: lead.address.street,
      houseNumber: lead.address.houseNumber,
      zipCode: lead.address.zipCode,
      city: lead.address.city,
    });
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
      return this.translate.instant(DATETIME_TODAY_AT_TRANSLATION_KEY, { time: timeLabel });
    }
    // Check if date is yesterday
    if (date >= startOfYesterday && date < startOfToday) {
      return this.translate.instant(DATETIME_YESTERDAY_AT_TRANSLATION_KEY, { time: timeLabel });
    }

    // For other dates, show full date with time
    const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return this.translate.instant(DATETIME_AT_TRANSLATION_KEY, { date: dateLabel, time: timeLabel });
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
    if (this.requiresConfirmation(status) && status !== this.lead()?.currentService?.status) {
      this.pendingStatusChange.set(status);
      this.confirmDialogTitle.set(this.translate.instant(CONFIRM_CHANGE_TO_TRANSLATION_KEY, { status: this.getStatusLabel(status) }));
      this.confirmDialogMessage.set(this.getConfirmMessage(status));
      this.showConfirmDialog.set(true);
      return;
    }
    
    this.newStatus.set(status);
    this.updateStatus(status);
  }

  private getConfirmMessage(status: LeadStatus): string {
    if (status === 'Disqualified') {
      return this.translate.instant(CONFIRM_DISQUALIFIED_TRANSLATION_KEY);
    }
    return this.translate.instant(CONFIRM_DEFAULT_TRANSLATION_KEY);
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

  protected callLead(): void {
    const phone = this.lead()?.consumer.phone;
    if (phone) {
      globalThis.location.href = `tel:${phone}`;
    }
  }

  protected emailLead(): void {
    const email = this.lead()?.consumer.email;
    if (email) {
      globalThis.location.href = `mailto:${email}`;
    }
  }

  protected navigateToLead(): void {
    const url = this.getMapUrl();
    globalThis.open(url, '_blank', 'noopener');
  }

  protected onTabChange(tabId: string): void {
    const validTabs = ['activity', 'appointments', 'timeline', 'files', 'preferences'] as const;
    if (validTabs.includes(tabId as typeof validTabs[number])) {
      this.activeTab.set(tabId as 'activity' | 'appointments' | 'timeline' | 'files' | 'preferences');
    }
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
        this.loadTimeline(lead.id, this.selectedService()?.id);
        this.announce(this.translate.instant(CALL_LOGGER_PROCESSED_TRANSLATION_KEY));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(CALL_LOGGER_PROCESS_ERROR_TRANSLATION_KEY));
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
        this.announce(this.translate.instant(ANNOUNCEMENT_STATUS_CHANGED_TRANSLATION_KEY, { status: this.getStatusLabel(status) }));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(ERROR_UPDATE_STATUS_TRANSLATION_KEY));
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
        const message = extractErrorMessage(err, this.translate.instant(ERROR_ASSIGN_LEAD_TRANSLATION_KEY));
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
    const serviceId = this.selectedService()?.id ?? null;
    this.router.navigate(['/app/offertes/new'], {
      queryParams: {
        leadId: lead.id,
        ...(serviceId ? { serviceId } : {}),
      },
    });
  }

  protected searchPartners(): void {
    const query = this.partnerSearch().trim();
    if (!query || this.partnerSearchLoading()) return;

    this.partnerSearchLoading.set(true);
    this.partnerSearchError.set(null);
    this.partnerResults.set([]);
    this.selectedPartnerId.set(null);

    this.partnersService
      .list({ search: query, page: 1, pageSize: 10, sortBy: 'businessName', sortOrder: 'asc' })
      .subscribe({
        next: (response) => {
          this.partnerResults.set(response.items ?? []);
          this.partnerSearchLoading.set(false);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('leads.detail.manualPartner.errors.searchPartners'));
          this.partnerSearchError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.partnerSearchLoading.set(false);
        },
      });
  }

  protected onPartnerSearchChange(value: string): void {
    this.partnerSearch.set(value);
    this.selectedPartnerId.set(null);
    this.createdOfferToken.set(null);
    this.createdOfferVakmanPriceCents.set(null);
    this.offerError.set(null);
    this.partnerSearch$.next(value);
  }

  protected onPartnerSelected(value: string): void {
    const opt = this.partnerOptions().find(o => o.label === value);
    if (!opt) return;
    this.selectedPartnerId.set(opt.value);
  }

  protected clearPartnerSearch(): void {
    this.partnerSearch.set('');
    this.partnerSearchError.set(null);
    this.partnerResults.set([]);
    this.selectedPartnerId.set(null);
    this.partnerSearchLoading.set(false);
  }

  protected createManualOffer(): void {
    const lead = this.lead();
    const service = this.selectedService();
    const partnerId = this.selectedPartnerId();
    const quote = this.acceptedQuote();
    if (!lead || !service || !partnerId || !quote || this.offerCreating()) return;
    if (!quote.leadServiceId) {
      this.offerError.set(this.translate.instant('offertes.partnerOffer.noService'));
      return;
    }

    this.offerCreating.set(true);
    this.offerError.set(null);
    this.createdOfferToken.set(null);
    this.createdOfferVakmanPriceCents.set(null);

    const expiresInHours = Math.max(1, Math.min(12, Math.floor(this.expiresInHours() || 12)));

    this.partnersService
      .createOfferFromQuote({ partnerId, quoteId: quote.id, expiresInHours })
      .subscribe({
        next: (resp) => {
          this.createdOfferToken.set(resp.publicToken);
          this.createdOfferVakmanPriceCents.set(resp.vakmanPriceCents);
          this.offerCreating.set(false);
          this.toast.success(this.translate.instant('leads.detail.manualPartner.success.offerCreated'));

          // Refresh lead state — offer creation publishes events that may reconcile stage/status.
          this.loadLead(lead.id);
          this.loadTimeline(lead.id, service.id);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('leads.detail.manualPartner.errors.createOffer'));
          this.offerError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.offerCreating.set(false);
        },
      });
  }

  protected openOfferWhatsApp(): void {
    const partner = this.selectedPartner();
    const token = this.createdOfferToken();
    const vakmanPrice = this.createdOfferVakmanPriceCents();
    if (!partner || !token || !vakmanPrice) return;

    const url = this.partnersService.buildOfferWhatsAppUrl(
      partner.contactPhone,
      partner.businessName,
      token,
      vakmanPrice,
    );

    globalThis.open(url, '_blank', 'noopener');
  }

  protected linkSelectedPartnerToLead(): void {
    const lead = this.lead();
    const partnerId = this.selectedPartnerId();
    if (!lead || !partnerId || this.offerCreating()) return;

    this.offerError.set(null);
    this.partnersService.linkLead(partnerId, lead.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('leads.detail.manualPartner.success.partnerLinked'));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('leads.detail.manualPartner.errors.linkPartner'));
        this.offerError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected formatEuroCents(cents: number): string {
    const lang = this.lang().lang;
    const locale = lang === 'nl' ? 'nl-NL' : 'en-US';
    return (cents / 100).toLocaleString(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  }

  private loadAcceptedQuoteForService(leadId: string, serviceId: string): void {
    this.acceptedQuoteLoading.set(true);
    this.acceptedQuoteError.set(null);
    this.acceptedQuote.set(null);

    this.quotesService
      .list({ leadId, status: 'Accepted', page: 1, pageSize: 50, sortBy: 'createdAt', sortOrder: 'desc' })
      .subscribe({
        next: (resp) => {
          const items = resp.items ?? [];
          const match = items.find(q => q.status === 'Accepted' && q.leadServiceId === serviceId) ?? null;
          this.acceptedQuote.set(match);
          this.acceptedQuoteLoading.set(false);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('leads.detail.manualPartner.errors.loadAcceptedQuote'));
          this.acceptedQuoteError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.acceptedQuoteLoading.set(false);
        },
      });
  }

  private loadAcceptedOfferForService(serviceId: string): void {
    this.acceptedOfferLoading.set(true);
    this.acceptedOfferError.set(null);
    this.acceptedOffer.set(null);

    this.partnersService
      .listOffers({ leadServiceId: serviceId, status: 'accepted', page: 1, pageSize: 1, sortBy: 'createdAt', sortOrder: 'desc' })
      .subscribe({
        next: (resp) => {
          const offer = (resp.items ?? []).at(0) ?? null;
          this.acceptedOffer.set(offer);
          this.acceptedOfferLoading.set(false);
        },
        error: (err) => {
          // Backstop: older backend versions could fail query-binding UUID filters and return 400 "invalid request".
          // If that happens, fall back to the service-scoped endpoint and filter client-side.
          const maybeError = err;
          const isInvalidRequest = maybeError?.status === 400 && maybeError?.error?.error === 'invalid request';
          if (isInvalidRequest) {
            this.partnersService.listServiceOffers(serviceId).subscribe({
              next: (fallbackResp) => {
                const accepted = (fallbackResp.items ?? [])
                  .filter(o => (o.status ?? '').toLowerCase() === 'accepted')
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                this.acceptedOffer.set(accepted.at(0) ?? null);
                this.acceptedOfferLoading.set(false);
              },
              error: (fallbackErr) => {
                const message = extractErrorMessage(fallbackErr, this.translate.instant('leads.detail.manualPartner.errors.loadAcceptedOffer'));
                this.acceptedOfferError.set(message);
                this.reporter.report(fallbackErr, { source: 'http', silent: true, userMessage: message });
                this.acceptedOfferLoading.set(false);
              },
            });
            return;
          }
          const message = extractErrorMessage(err, this.translate.instant('leads.detail.manualPartner.errors.loadAcceptedOffer'));
          this.acceptedOfferError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.acceptedOfferLoading.set(false);
        },
      });
  }

  protected viewAcceptedOffer(): void {
    const offer = this.acceptedOffer();
    if (!offer?.id) return;
    this.router.navigate(['/app/offers', offer.id, 'preview']);
  }

  protected editLead(): void {
    const lead = this.lead();
    if (!lead) return;
    this.router.navigate(['/app/leads', lead.id, 'edit']);
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
        this.loadTimeline(lead.id, this.selectedService()?.id);
        this.focusNoteBox();
        this.announce(this.translate.instant(ANNOUNCEMENT_NOTE_ADDED_TRANSLATION_KEY));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(ERROR_ADD_NOTE_TRANSLATION_KEY));
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
        const message = extractErrorMessage(err, this.translate.instant(ERROR_LOAD_NOTES_TRANSLATION_KEY));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadTimeline(id: string, serviceId?: string): void {
    this.timelineLoading.set(true);
    this.timelineError.set(null);
    this.leadsService.getTimeline(id, serviceId).subscribe({
      next: (response) => {
        this.timelineItems.set(response.items ?? []);
        this.timelineLoading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(ERROR_LOAD_TIMELINE_TRANSLATION_KEY));
        this.timelineError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.timelineLoading.set(false);
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
        const message = extractErrorMessage(err, this.translate.instant(ERROR_LOAD_AI_ANALYSIS_TRANSLATION_KEY));
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
            this.announce(this.translate.instant(ANNOUNCEMENT_AI_NO_NEW_INFO_TRANSLATION_KEY));
          } else {
            this.aiAnalysisNoNewInfo.set(false);
            this.announce(this.translate.instant(ANNOUNCEMENT_AI_UPDATED_TRANSLATION_KEY));
            // Reload photo analysis as it may have been updated during AI analysis
            this.loadPhotoAnalysis(lead.id, service.id);
          }
        } else {
          const message = this.translate.instant(ERROR_UNEXPECTED_RESPONSE_TRANSLATION_KEY);
          this.aiAnalysisError.set(message);
          this.reporter.report(new Error(message), { source: 'manual', silent: true, userMessage: message });
        }
        this.aiAnalysisRefreshing.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(ERROR_ANALYZE_LEAD_TRANSLATION_KEY));
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
    return match?.label ?? this.translate.instant(UNASSIGNED_TRANSLATION_KEY);
  };

  protected readonly getTimelineTypeLabel = (type: LeadTimelineItem['type']): string => {
    this.lang();
    return this.translate.instant(`leads.detail.timeline.types.${type}`);
  };

  protected readonly getTimelineTypeBadgeClass = (type: LeadTimelineItem['type']): string => {
    if (type === 'ai') {
      return 'bg-indigo-100 text-indigo-700';
    }
    if (type === 'stage') {
      return 'bg-emerald-100 text-emerald-700';
    }
    return 'bg-zinc-100 text-zinc-700';
  };

  protected readonly getTimelineMissingInformation = (item: LeadTimelineItem): string[] => {
    const metadata = item.metadata;
    const value = metadata['missingInformation'];
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
  };

  protected readonly getTimelineContactMessage = (item: LeadTimelineItem): TimelineContactMessage | null => {
    const metadata = item.metadata as Record<string, unknown>;
    return (
      this.buildWhatsAppSentMessage(metadata) ||
      this.buildWhatsAppDraftMessage(metadata) ||
      this.buildPreferredContactMessage(metadata)
    );
  };

  protected readonly getTimelineRecommendedAction = (item: LeadTimelineItem): string | null => {
    const metadata = item.metadata;
    const action = metadata['recommendedAction'];
    return typeof action === 'string' && action.trim() !== '' ? action.trim() : null;
  };

  protected readonly getTimelinePartnerSummary = (item: LeadTimelineItem): string | null => {
    const metadata = item.metadata;
    const matches = metadata['matches'];
    if (!Array.isArray(matches)) {
      return null;
    }
    const normalized = matches
      .map((match) => this.parsePartnerMatch(match))
      .filter((match): match is { name: string; distanceKm?: number } => Boolean(match));
    if (normalized.length === 0) {
      return null;
    }
    const preview = normalized.slice(0, 2).map((match) => {
      if (typeof match.distanceKm === 'number') {
        return `${match.name} (${this.formatDistanceKm(match.distanceKm)})`;
      }
      return match.name;
    });
    if (normalized.length > 2) {
      preview.push(`+${normalized.length - 2}`);
    }
    return preview.join(', ');
  };

  protected readonly getTimelineEstimation = (item: LeadTimelineItem): { priceRange?: string; scope?: string; notes?: string } | null => {
    const metadata = item.metadata;
    const priceRange = this.readTimelineText(metadata['priceRange']);
    const scope = this.readTimelineText(metadata['scope']);
    const notes = this.readTimelineText(metadata['notes']);
    if (!priceRange && !scope && !notes) {
      return null;
    }
    const result: { priceRange?: string; scope?: string; notes?: string } = {};
    if (priceRange) {
      result.priceRange = priceRange;
    }
    if (scope) {
      result.scope = scope;
    }
    if (notes) {
      result.notes = notes;
    }
    return result;
  };

  protected readonly copiedContactMessage = signal<string | null>(null);

  protected copyContactMessage(itemId: string, message: string): void {
    navigator.clipboard.writeText(message).then(() => {
      this.copiedContactMessage.set(itemId);
      this.announce(this.translate.instant(TIMELINE_MESSAGE_COPIED_TRANSLATION_KEY));
      setTimeout(() => {
        if (this.copiedContactMessage() === itemId) {
          this.copiedContactMessage.set(null);
        }
      }, 2000);
    }).catch(err => {
      this.reporter.report(err, { source: 'runtime', silent: true });
    });
  }

  protected openWhatsApp(phone: string, message: string): void {
    if (!phone) return;
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = phone.replaceAll(/[^0-9+]/g, '');
    globalThis.open?.(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
  }

  protected composeEmail(email: string | undefined, message: string): void {
    if (!email) return;
    const encodedSubject = encodeURIComponent('Follow-up on your request');
    const encodedBody = encodeURIComponent(message);
    globalThis.location.href = `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
  }

  protected readonly getTimelineScore = (item: LeadTimelineItem): { score: number; preAi?: number; version?: string } | null => {
    const metadata = item.metadata;
    const score = this.parseTimelineNumber(metadata['leadScore']);
    if (score === null) {
      return null;
    }
    const preAi = this.parseTimelineNumber(metadata['leadScorePreAI']);
    const versionValue = typeof metadata['leadScoreVersion'] === 'string' ? metadata['leadScoreVersion'] : null;
    const result: { score: number; preAi?: number; version?: string } = { score };
    if (preAi !== null) {
      result.preAi = preAi;
    }
    if (versionValue) {
      result.version = versionValue;
    }
    return result;
  };

  protected readonly getTimelineDraftedQuote = (item: LeadTimelineItem): { quoteId: string; quoteNumber: string; itemCount: number; catalogItems: number; adHocItems: number } | null => {
    const metadata = item.metadata;
    const quoteId = metadata['quoteId'];
    const quoteNumber = metadata['quoteNumber'];
    if (typeof quoteId !== 'string' || typeof quoteNumber !== 'string') {
      return null;
    }
    return {
      quoteId,
      quoteNumber,
      itemCount: typeof metadata['itemCount'] === 'number' ? metadata['itemCount'] : 0,
      catalogItems: typeof metadata['catalogItems'] === 'number' ? metadata['catalogItems'] : 0,
      adHocItems: typeof metadata['adHocItems'] === 'number' ? metadata['adHocItems'] : 0,
    };
  };

  protected readonly getTimelineAppointmentApproval = (item: LeadTimelineItem): { appointmentId: string } | null => {
    const metadata = item.metadata ?? {};
    const appointmentId = this.readTimelineText(
      metadata['appointmentId'] ??
      metadata['appointmentID'] ??
      metadata['appointment_id'] ??
      metadata['AppointmentId'] ??
      metadata['AppointmentID'],
    );
    const statusValue = this.readTimelineText(
      metadata['appointmentStatus'] ??
      metadata['appointment_status'] ??
      metadata['AppointmentStatus'] ??
      metadata['status'] ??
      metadata['Status'],
    );
    const status = statusValue?.toLowerCase() ?? null;
    const isRequested = status ? status === 'requested' : this.isTimelineAppointmentRequested(item);
    if (!isRequested) {
      return null;
    }
    if (appointmentId) {
      return { appointmentId };
    }
    const startTime = this.readTimelineText(
      metadata['startTime'] ??
      metadata['StartTime'] ??
      metadata['appointmentStartTime'] ??
      metadata['AppointmentStartTime'],
    );
    const matched = this.findRequestedAppointmentByStart(startTime);
    if (matched) {
      return { appointmentId: matched.id };
    }
    const requested = this.appointments().filter(apt => apt.status === 'requested');
    if (requested.length === 1) {
      const only = requested.at(0);
      if (only) {
        return { appointmentId: only.id };
      }
    }
    return null;
  };

  protected readonly getTimelinePhotoAnalysis = (item: LeadTimelineItem): {
    photoCount: number;
    confidenceLevel: string;
    observations: string[];
    scopeAssessment: string;
    costIndicators: string;
    safetyConcerns: string[];
    measurements: { description: string; value: number; unit: string; type: string; confidence: string }[];
    needsOnsiteMeasurement: string[];
    discrepancies: string[];
    extractedText: string[];
    suggestedSearchTerms: string[];
  } | null => {
    const m = item.metadata;
    if (m['photoCount'] === undefined || !Array.isArray(m['observations'])) {
      return null;
    }
    return {
      photoCount: typeof m['photoCount'] === 'number' ? m['photoCount'] : 0,
      confidenceLevel: typeof m['confidenceLevel'] === 'string' ? m['confidenceLevel'] : '',
      observations: Array.isArray(m['observations']) ? (m['observations'] as string[]) : [],
      scopeAssessment: typeof m['scopeAssessment'] === 'string' ? m['scopeAssessment'] : '',
      costIndicators: typeof m['costIndicators'] === 'string' ? m['costIndicators'] : '',
      safetyConcerns: Array.isArray(m['safetyConcerns']) ? (m['safetyConcerns'] as string[]) : [],
      measurements: Array.isArray(m['measurements']) ? (m['measurements'] as { description: string; value: number; unit: string; type: string; confidence: string }[]) : [],
      needsOnsiteMeasurement: Array.isArray(m['needsOnsiteMeasurement']) ? (m['needsOnsiteMeasurement'] as string[]) : [],
      discrepancies: Array.isArray(m['discrepancies']) ? (m['discrepancies'] as string[]) : [],
      extractedText: Array.isArray(m['extractedText']) ? (m['extractedText'] as string[]) : [],
      suggestedSearchTerms: Array.isArray(m['suggestedSearchTerms']) ? (m['suggestedSearchTerms'] as string[]) : [],
    };
  };

  protected viewDraftQuote(quoteId: string): void {
    this.router.navigate(['/app/offertes', quoteId]);
  }

  private extractPhoneFromWhatsAppUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const marker = 'wa.me/';
    const markerIndex = value.indexOf(marker);
    if (markerIndex === -1) {
      return undefined;
    }
    const afterMarker = value.slice(markerIndex + marker.length);
    const phonePart = afterMarker.split('?')[0] ?? '';
    const cleaned = phonePart.replaceAll(/[^0-9+]/g, '');
    return cleaned || undefined;
  }

  private buildWhatsAppSentMessage(metadata: Record<string, unknown>): TimelineContactMessage | null {
    const messageContent = metadata['messageContent'];
    if (typeof messageContent !== 'string') {
      return null;
    }
    const trimmed = messageContent.trim();
    if (!trimmed) {
      return null;
    }
    const statusValue = typeof metadata['status'] === 'string' ? metadata['status'] : 'sent';
    const phoneValue = typeof metadata['phoneNumber'] === 'string' ? metadata['phoneNumber'] : undefined;
    return {
      channel: 'WhatsApp',
      message: trimmed,
      status: statusValue as WhatsAppMessageStatus,
      ...(phoneValue ? { phone: phoneValue } : {}),
    };
  }

  private buildWhatsAppDraftMessage(metadata: Record<string, unknown>): TimelineContactMessage | null {
    const drafts = metadata['drafts'];
    if (!drafts || typeof drafts !== 'object') {
      return null;
    }
    const draftMessage = (drafts as Record<string, unknown>)['whatsappMessage'];
    if (typeof draftMessage !== 'string') {
      return null;
    }
    const trimmed = draftMessage.trim();
    if (!trimmed) {
      return null;
    }
    const statusValue = (drafts as Record<string, unknown>)['status'];
    const status = typeof statusValue === 'string' ? statusValue : 'draft';
    const phone = this.extractPhoneFromWhatsAppUrl(metadata['whatsappUrl']);
    return {
      channel: 'WhatsApp',
      message: trimmed,
      status: status as WhatsAppMessageStatus,
      ...(phone ? { phone } : {}),
    };
  }

  private buildPreferredContactMessage(metadata: Record<string, unknown>): TimelineContactMessage | null {
    const channel = metadata['preferredContactChannel'];
    const message = metadata['suggestedContactMessage'];
    if ((channel !== 'WhatsApp' && channel !== 'Email') || typeof message !== 'string') {
      return null;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      return null;
    }
    const status = channel === 'WhatsApp' ? 'draft' : undefined;
    const phone = channel === 'WhatsApp' && typeof metadata['phoneNumber'] === 'string' ? metadata['phoneNumber'] : undefined;
    return {
      channel,
      message: trimmed,
      ...(status ? { status } : {}),
      ...(phone ? { phone } : {}),
    };
  }

  private isTimelineAppointmentRequested(item: LeadTimelineItem): boolean {
    const title = item.title?.toLowerCase() ?? '';
    const summary = item.summary?.toLowerCase() ?? '';
    return title.includes('aangevraagd') || summary.includes('aangevraagd') || title.includes('requested') || summary.includes('requested');
  }

  private findRequestedAppointmentByStart(startTime: string | null): AppointmentResponse | null {
    if (!startTime) return null;
    const target = new Date(startTime);
    if (Number.isNaN(target.valueOf())) return null;
    const requested = this.appointments().filter(apt => apt.status === 'requested');
    return requested.find(apt => {
      const aptTime = new Date(apt.startTime);
      if (Number.isNaN(aptTime.valueOf())) return false;
      return Math.abs(aptTime.getTime() - target.getTime()) < 60000;
    }) ?? null;
  }

  private readTimelineText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
  }

  private parsePartnerMatch(value: unknown): { name: string; distanceKm?: number } | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as Record<string, unknown>;
    const nameValue = record['businessName'] ?? record['BusinessName'] ?? record['name'] ?? record['Name'];
    if (typeof nameValue !== 'string' || nameValue.trim() === '') {
      return null;
    }
    const distanceValue = record['distanceKm'] ?? record['DistanceKm'];
    const parsedDistance = this.parseTimelineNumber(distanceValue ?? null);
    if (parsedDistance === null) {
      return { name: nameValue.trim() };
    }
    return { name: nameValue.trim(), distanceKm: parsedDistance };
  }

  private formatDistanceKm(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded} km`;
  }

  private parseTimelineNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

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
    // Prevent submit if note is too long
    if (this.consumerNoteTooLong()) {
      this.error.set(this.consumerNoteError());
      return;
    }

    this.saving.set(true);
    const consumerNoteValue = this.newServiceConsumerNote();
    const sourceValue = this.newServiceSource();
    this.leadsService.addService(lead.id, {
      serviceType,
      closeCurrentStatus: this.closeCurrentService(),
      ...(consumerNoteValue && { consumerNote: consumerNoteValue }),
      ...(sourceValue && { source: sourceValue }),
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
        const message = extractErrorMessage(err, this.translate.instant(ERROR_ADD_SERVICE_TRANSLATION_KEY));
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
        const message = extractErrorMessage(err, this.translate.instant(ERROR_UPDATE_SERVICE_STATUS_TRANSLATION_KEY));
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
      const lead = this.lead();
      if (lead) {
        this.loadTimeline(lead.id, service.id);
      }
    }
  }

  protected requiresConfirmation(status: LeadStatus): boolean {
    return status === 'Disqualified';
  }

  protected onWorkflowSelectionChange(value: string | null): void {
    this.selectedLeadWorkflowId.set(value ?? null);
  }

  protected saveLeadWorkflowOverride(): void {
    const lead = this.lead();
    if (!lead) return;

    const workflowId = this.selectedLeadWorkflowId();
    if (!workflowId) {
      this.clearLeadWorkflowOverride();
      return;
    }

    this.workflowSaving.set(true);
    this.workflowError.set(null);
    this.orgService.upsertLeadWorkflowOverride(lead.id, {
      leadId: lead.id,
      workflowId,
      overrideMode: 'manual',
    }).pipe(
      switchMap(() => this.reloadLeadWorkflowResolution(lead.id)),
      finalize(() => this.workflowSaving.set(false)),
    ).subscribe({
      next: () => {
        this.announce(this.translate.instant(WORKFLOW_SAVED_TRANSLATION_KEY));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(WORKFLOW_SAVE_FAILED_TRANSLATION_KEY));
        this.workflowError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected clearLeadWorkflowOverride(): void {
    const lead = this.lead();
    if (!lead) return;

    this.workflowSaving.set(true);
    this.workflowError.set(null);
    this.orgService.deleteLeadWorkflowOverride(lead.id).pipe(
      switchMap(() => this.reloadLeadWorkflowResolution(lead.id)),
      finalize(() => this.workflowSaving.set(false)),
    ).subscribe({
      next: () => {
        this.selectedLeadWorkflowId.set(null);
        this.leadWorkflowOverrideMode.set(null);
        this.announce(this.translate.instant(WORKFLOW_CLEARED_TRANSLATION_KEY));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(WORKFLOW_CLEAR_FAILED_TRANSLATION_KEY));
        this.workflowError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadLeadWorkflowData(leadID: string): void {
    this.workflowError.set(null);
    forkJoin({
      workflows: this.orgService.getWorkflowEngineWorkflows(),
      override: this.orgService.getLeadWorkflowOverride(leadID).pipe(catchError(() => of(null))),
      resolved: this.orgService.resolveLeadWorkflow(leadID),
    }).subscribe({
      next: ({ workflows, override, resolved }) => {
        this.workflowProfiles.set(workflows);
        this.selectedLeadWorkflowId.set(override?.workflowId ?? resolved.workflow?.id ?? null);
        this.leadWorkflowOverrideMode.set(override?.overrideMode ?? null);
        this.leadWorkflowResolutionSource.set(resolved.resolutionSource ?? null);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(WORKFLOW_LOAD_FAILED_TRANSLATION_KEY));
        this.workflowError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private reloadLeadWorkflowResolution(leadID: string) {
    return forkJoin({
      override: this.orgService.getLeadWorkflowOverride(leadID).pipe(catchError(() => of(null))),
      resolved: this.orgService.resolveLeadWorkflow(leadID),
    }).pipe(switchMap(({ override, resolved }) => {
      this.selectedLeadWorkflowId.set(override?.workflowId ?? resolved.workflow?.id ?? null);
      this.leadWorkflowOverrideMode.set(override?.overrideMode ?? null);
      this.leadWorkflowResolutionSource.set(resolved.resolutionSource ?? null);
      return of(void 0);
    }));
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
      this.appointmentsError.set(this.translate.instant(APPOINTMENT_NO_SERVICE_ERROR_TRANSLATION_KEY));
      return;
    }

    const descriptionValue = this.appointmentNotes().trim();
    const locationValue = this.appointmentLocation().trim();
    const payload: CreateAppointmentRequest = {
      leadId: lead.id,
      leadServiceId,
      type: 'lead_visit',
      title: this.appointmentTitle().trim() || this.translate.instant(APPOINTMENT_DEFAULT_TITLE_TRANSLATION_KEY),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      allDay: false,
      ...(descriptionValue && { description: descriptionValue }),
      ...(locationValue && { location: locationValue }),
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
        this.announce(this.translate.instant(APPOINTMENT_CREATED_TRANSLATION_KEY));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(APPOINTMENT_CREATE_ERROR_TRANSLATION_KEY));
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

    const measurementsValue = this.reportMeasurements().trim();
    const accessDifficultyValue = this.reportAccessDifficulty();
    const notesValue = this.reportNotes().trim();
    const payload: UpsertVisitReportRequest = {
      ...(measurementsValue && { measurements: measurementsValue }),
      ...(accessDifficultyValue && { accessDifficulty: accessDifficultyValue }),
      ...(notesValue && { notes: notesValue }),
    };

    this.reportSaving.set(true);
    this.appointmentsService.upsertVisitReport(appointment.id, payload).subscribe({
      next: (response) => {
        const successMessage = this.translate.instant(REPORT_SAVED_TRANSLATION_KEY);
        this.visitReport.set(response);
        this.syncReportFields(response);
        this.reportSaving.set(false);
        this.toast.success(successMessage);
        this.announce(successMessage);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(REPORT_ERROR_TRANSLATION_KEY));
        this.appointmentsError.set(message);
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.reportSaving.set(false);
      },
    });
  }

  protected addAttachment(): void {
    const appointment = this.selectedAppointment();
    if (!appointment || !this.canAddAttachment()) return;

    const sizeBytesValue = Number(this.attachmentSizeBytes());
    const contentTypeValue = this.attachmentContentType().trim();
    const payload: CreateAppointmentAttachmentRequest = {
      fileKey: this.attachmentFileKey().trim(),
      fileName: this.attachmentFileName().trim(),
      ...(contentTypeValue && { contentType: contentTypeValue }),
      ...(Number.isFinite(sizeBytesValue) && { sizeBytes: sizeBytesValue }),
    };

    this.attachmentSaving.set(true);
    this.appointmentsService.createAttachment(appointment.id, payload).subscribe({
      next: (created) => {
        this.attachments.update(items => [created, ...items]);
        this.resetAttachmentForm();
        this.attachmentSaving.set(false);
        this.announce(this.translate.instant(APPOINTMENT_ATTACHMENT_SAVED_TRANSLATION_KEY));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(APPOINTMENT_ATTACHMENT_ERROR_TRANSLATION_KEY));
        this.appointmentsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.attachmentSaving.set(false);
      },
    });
  }

  protected approveAppointment(appointmentId: string): void {
    if (this.approvingAppointmentId()) return;

    this.approvingAppointmentId.set(appointmentId);
    this.appointmentsError.set(null);

    this.appointmentsService.updateStatus(appointmentId, { status: 'scheduled' }).subscribe({
      next: (updated) => {
        this.appointments.update(items =>
          items.map(item => item.id === appointmentId ? updated : item),
        );
        this.approvingAppointmentId.set(null);
        this.announce(this.translate.instant(APPOINTMENT_APPROVED_TRANSLATION_KEY));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(APPOINTMENT_APPROVE_ERROR_TRANSLATION_KEY));
        this.appointmentsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.approvingAppointmentId.set(null);
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
        const firstItem = items[0];
        if (!this.selectedAppointmentId() && firstItem) {
          this.selectedAppointmentId.set(firstItem.id);
          this.loadAppointmentDetails(firstItem.id);
        }
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant(APPOINTMENT_LOAD_ERROR_TRANSLATION_KEY));
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
        const message = extractErrorMessage(err, this.translate.instant(APPOINTMENT_REPORT_LOAD_ERROR_TRANSLATION_KEY));
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
        const message = extractErrorMessage(err, this.translate.instant(APPOINTMENT_ATTACHMENTS_LOAD_ERROR_TRANSLATION_KEY));
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
        const message = extractErrorMessage(err, 'Failed to load attachments');
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
    this.announce(this.translate.instant(FILES_UPLOADED_TRANSLATION_KEY));
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
        const message = extractErrorMessage(err, 'Failed to delete attachment');
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
        const message = extractErrorMessage(err, 'Failed to get download URL');
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Service Type Editing
  // ─────────────────────────────────────────────────────────────────────────────

  protected readonly editingServiceTypeId = signal<string | null>(null);
  protected readonly editingServiceType = signal<string | null>(null);
  protected readonly savingServiceType = signal(false);

  // Confirmation dialog for service type change
  protected readonly showServiceTypeConfirmDialog = signal(false);
  protected readonly confirmServiceTypeOldValue = signal<string>('');
  protected readonly confirmServiceTypeNewValue = signal<string>('');
  protected readonly pendingServiceTypeService = signal<LeadService | null>(null);

  protected readonly serviceTypeConfirmMessage = computed(() => {
    const oldValue = this.confirmServiceTypeOldValue();
    const newValue = this.confirmServiceTypeNewValue();
    return `Change service type from "${oldValue}" to "${newValue}"?`;
  });

  protected startEditServiceType(service: LeadService): void {
    this.editingServiceTypeId.set(service.id);
    this.editingServiceType.set(service.serviceType);
  }

  protected cancelEditServiceType(): void {
    this.editingServiceTypeId.set(null);
    this.editingServiceType.set(null);
  }

  protected confirmServiceTypeChange(): void {
    const service = this.pendingServiceTypeService();
    const newType = this.confirmServiceTypeNewValue();
    if (!service || !newType) return;

    this.saveServiceTypeInternal(service, newType);
    this.cancelServiceTypeConfirmDialog();
  }

  protected cancelServiceTypeConfirmDialog(): void {
    this.showServiceTypeConfirmDialog.set(false);
    this.confirmServiceTypeOldValue.set('');
    this.confirmServiceTypeNewValue.set('');
    this.pendingServiceTypeService.set(null);
  }

  protected saveServiceTypeHandler(): void {
    const lead = this.lead();
    const serviceId = this.editingServiceTypeId();
    const newType = this.editingServiceType();
    if (!lead || !serviceId || !newType) return;

    const service = lead.services.find(s => s.id === serviceId);
    if (!service) return;

    // Show confirmation dialog
    this.pendingServiceTypeService.set(service);
    this.confirmServiceTypeOldValue.set(service.serviceType);
    this.confirmServiceTypeNewValue.set(newType);
    this.showServiceTypeConfirmDialog.set(true);
  }

  private saveServiceTypeInternal(service: LeadService, newType: string): void {
    const lead = this.lead();
    if (!lead) return;

    this.savingServiceType.set(true);
    this.leadsService.updateServiceType(lead.id, service.id, { serviceType: newType }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.cancelEditServiceType();
        this.savingServiceType.set(false);
        this.announce(`Service type updated to ${newType}`);
        // Reload timeline to show the change
        this.loadTimeline(lead.id, service.id);
      },
      error: (err) => {
        const message = extractErrorMessage(err, 'Failed to update service type');
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.savingServiceType.set(false);
      },
    });
  }
}

interface ActivityEntry {
  id: string;
  type: 'audit' | LeadNoteType;
  timestamp: string;
  user: string;
  message: string;
}
