import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { EMPTY, catchError, finalize } from 'rxjs';
import { ToastService } from '../../core/services/toast.service';
import { SSEService, type SSEEvent } from '../../core/services/sse.service';
import { LeadsService } from '../../core/services/leads.service';
import type { CreateLeadRequest, Lead, LeadService } from '../../core/services/leads.types';
import { ServiceTypesService } from '../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../core/services/service-types.types';
import { WhatsAppDeviceStatusService } from '../../core/services/whatsapp-device-status.service';
import { WhatsAppInboxService } from '../../core/services/whatsapp-inbox.service';
import { WhatsAppUnreadCountService } from '../../core/services/whatsapp-unread-count.service';
import {
  REPLY_SUGGESTION_SCENARIO_OPTIONS,
  isNonGenericReplyScenario,
  type ReplySuggestionScenario,
} from '../../core/services/reply-suggestion.types';
import type {
  AttachWhatsAppMessageToLeadRequest,
  EditWhatsAppMessageRequest,
  LinkWhatsAppConversationLeadRequest,
  ReactWhatsAppMessageRequest,
  SaveWhatsAppMessagesToLeadRequest,
  SetWhatsAppDisappearingTimerRequest,
  SendWhatsAppConversationMessageRequest,
  ToggleWhatsAppConversationStateRequest,
  ToggleWhatsAppMessageStateRequest,
  WhatsAppConversation,
  WhatsAppConversationActionResponse,
  WhatsAppMediaDownloadResponse,
  WhatsAppMessage,
  WhatsAppMessageComposerType,
  WhatsAppPortalMetadata,
  WhatsAppPortalContact,
  WhatsAppPortalLocation,
  WhatsAppPortalPoll,
  WhatsAppPortalReply,
  WhatsAppPresenceType,
  WhatsAppWebhookPayload,
} from '../../core/services/whatsapp-inbox.types';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MenuComponent, type MenuItem, type MenuSection } from '../../shared/components/menu/menu.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { SelectComponent, type SelectOption } from '../../shared/components/select/select.component';

type WhatsAppConversationEventPayload = { conversation?: Partial<WhatsAppConversation> };
type WhatsAppMessageEventPayload = {
  conversation?: Partial<WhatsAppConversation>;
  message?: Partial<WhatsAppMessage>;
};

type MessageMutationBadge = {
  key: string;
  icon: string;
  kind: 'edited' | 'deleted' | 'revoked';
  label: string;
};

type MessageReactionSummary = {
  key: string;
  reaction: string;
  count: number;
  tooltip: string;
};

type MessageReplyContext = {
  messageId?: string;
  body: string;
};

type MessageMediaContent = {
  kind: 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'video_note';
  label: string;
  url: string | null;
  caption: string | null;
  filename: string | null;
  placeholder: string;
};

type MessageContactCard = {
  name: string;
  phone?: string;
};

type MessageLocationCard = {
  latitude?: string;
  longitude?: string;
  name?: string;
  address?: string;
  live?: boolean;
};

type MessagePollCard = {
  question?: string;
  options: string[];
  selectedOptions: string[];
  maxAnswer?: string;
};

type ConversationListFilter = 'all' | 'unread' | 'archived';

type ConversationListFilterOption = {
  value: ConversationListFilter;
  label: string;
};

type ThreadActionState = {
  archived?: boolean;
  pinned?: boolean;
  timerSeconds?: number;
};

type ComposerTypeOption = {
  value: WhatsAppMessageComposerType;
  label: string;
  icon: string;
};

const composerTypeOptions: ComposerTypeOption[] = [
  { value: 'text', label: 'Tekst', icon: 'message-square-text' },
  { value: 'image', label: 'Afbeelding', icon: 'image' },
  { value: 'video', label: 'Video', icon: 'video' },
  { value: 'audio', label: 'Audio', icon: 'mic' },
  { value: 'file', label: 'Bestand', icon: 'paperclip' },
  { value: 'sticker', label: 'Sticker', icon: 'sticker' },
  { value: 'contact', label: 'Contact', icon: 'contact-round' },
  { value: 'location', label: 'Locatie', icon: 'map-pinned' },
  { value: 'poll', label: 'Poll', icon: 'list-checks' },
];

const reactionOptions = ['👍', '❤️', '😂', '😮', '🙏', '✅', '👀', '🔥'] as const;
const quickReactionOptions = ['👍', '❤️', '😂', '🙏'] as const;
const disappearingTimerChoices = [
  { value: 0, label: 'Uit' },
  { value: 86400, label: '24 uur' },
  { value: 604800, label: '7 dagen' },
  { value: 7776000, label: '90 dagen' },
] as const;

const conversationListFilterOptions: readonly ConversationListFilterOption[] = [
	{ value: 'all', label: 'Alles' },
	{ value: 'unread', label: 'Ongelezen' },
	{ value: 'archived', label: 'Archief' },
];

@Component({
  selector: 'app-whatsapp-inbox',
  imports: [TranslateModule, LucideAngularModule, ButtonComponent, ConfirmDialogComponent, MenuComponent, PageLayoutComponent, SelectComponent],
  templateUrl: './whatsapp-inbox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppInboxComponent {
  private readonly inbox = inject(WhatsAppInboxService);
  private readonly leads = inject(LeadsService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly sse = inject(SSEService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly unreadCount = inject(WhatsAppUnreadCountService);
  protected readonly deviceStatus = inject(WhatsAppDeviceStatusService);

  protected readonly conversations = signal<WhatsAppConversation[]>([]);
  protected readonly messages = signal<WhatsAppMessage[]>([]);
  protected readonly selectedConversationId = signal<string | null>(null);
  protected readonly loadingConversations = signal(false);
  protected readonly loadingMessages = signal(false);
  protected readonly sendingMessage = signal(false);
  protected readonly suggestingReply = signal(false);
  protected readonly sendingPresence = signal<WhatsAppPresenceType | null>(null);
  protected readonly conversationSearchQuery = signal('');
  protected readonly conversationListFilter = signal<ConversationListFilter>('all');
  protected readonly conversationListFilterOptions = conversationListFilterOptions;
  protected readonly composerOptionsExpanded = signal(false);
  protected readonly composerType = signal<WhatsAppMessageComposerType>('text');
  protected readonly composerBody = signal('');
  protected readonly composerCaption = signal('');
  protected readonly composerAttachmentName = signal<string | null>(null);
  protected readonly composerAttachmentBase64 = signal<string | null>(null);
  protected readonly composerIsEncodingAttachment = signal(false);
  protected readonly composerViewOnce = signal(false);
  protected readonly composerCompress = signal(false);
  protected readonly composerPushToTalk = signal(false);
  protected readonly composerContactName = signal('');
  protected readonly composerContactPhone = signal('');
  protected readonly composerLatitude = signal('');
  protected readonly composerLongitude = signal('');
  protected readonly composerPollQuestion = signal('');
  protected readonly composerPollOptionOne = signal('');
  protected readonly composerPollOptionTwo = signal('');
  protected readonly composerPollOptionThree = signal('');
  protected readonly composerPollOptionFour = signal('');
  protected readonly composerPollMaxAnswer = signal(1);
  protected readonly suggestionScenario = signal<ReplySuggestionScenario>('generic');
  protected readonly suggestionScenarioNotes = signal('');
  protected readonly aiSuggestionSeed = signal<string | null>(null);
  protected readonly aiSuggestionConversationId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly threadActionState = signal<Record<string, ThreadActionState>>({});
  protected readonly pendingReactionMessage = signal<WhatsAppMessage | null>(null);
  protected readonly pendingEditMessage = signal<WhatsAppMessage | null>(null);
  protected readonly pendingDeleteMessage = signal<WhatsAppMessage | null>(null);
  protected readonly pendingRevokeMessage = signal<WhatsAppMessage | null>(null);
  protected readonly pendingDisappearingTimerConversationId = signal<string | null>(null);
  protected readonly pendingDeleteConversationId = signal<string | null>(null);
  protected readonly reactionDraft = signal('');
  protected readonly editMessageDraft = signal('');
  protected readonly disappearingTimerDraft = signal(0);
  protected readonly reactingMessageId = signal<string | null>(null);
  protected readonly editingMessageId = signal<string | null>(null);
  protected readonly deletingMessageId = signal<string | null>(null);
  protected readonly revokingMessageId = signal<string | null>(null);
  protected readonly togglingConversationAction = signal<string | null>(null);
  protected readonly starringMessageId = signal<string | null>(null);
  protected readonly downloadingMessageId = signal<string | null>(null);
  protected readonly attachingMessageId = signal<string | null>(null);
  protected readonly savingImportantMessages = signal(false);
  protected readonly importantSelectionMode = signal(false);
  protected readonly selectedImportantMessageIds = signal<string[]>([]);
  protected readonly linkedLead = signal<Lead | null>(null);
  protected readonly linkedLeadLoading = signal(false);
  protected readonly linkedLeadServiceId = signal<string | null>(null);
  protected readonly availableServiceTypes = signal<ServiceTypeItem[]>([]);
  protected readonly leadSearchQuery = signal('');
  protected readonly leadSearchResults = signal<Lead[]>([]);
  protected readonly leadSearchLoading = signal(false);
  protected readonly leadRelationshipBusy = signal<'link' | 'unlink' | 'create' | null>(null);
  protected readonly showLeadSearchPanel = signal(false);
  protected readonly showCreateLeadPanel = signal(false);
  protected readonly createLeadFirstName = signal('');
  protected readonly createLeadLastName = signal('');
  protected readonly createLeadEmail = signal('');
  protected readonly createLeadStreet = signal('');
  protected readonly createLeadHouseNumber = signal('');
  protected readonly createLeadZipCode = signal('');
  protected readonly createLeadCity = signal('');
  protected readonly createLeadServiceType = signal('');
  protected readonly createLeadConsumerRole = signal<'Owner' | 'Tenant' | 'Landlord'>('Owner');
  protected readonly isMobileViewport = signal(false);
  protected readonly reactionChoices = reactionOptions;
  protected readonly quickReactionChoices = quickReactionOptions;
  protected readonly disappearingTimerOptions = disappearingTimerChoices;
  protected readonly composerTypes = composerTypeOptions;
  protected readonly suggestionScenarioOptions = REPLY_SUGGESTION_SCENARIO_OPTIONS.map(option => ({
    label: option.label,
    value: option.value,
  }));
  protected readonly selectedSuggestionScenarioDescription = computed(() => {
    return REPLY_SUGGESTION_SCENARIO_OPTIONS.find(option => option.value === this.suggestionScenario())?.description ?? '';
  });
  protected readonly primaryComposerTypes = composerTypeOptions.filter(option =>
    option.value === 'text' || option.value === 'image' || option.value === 'file' || option.value === 'contact'
  );
  protected readonly advancedComposerTypes = composerTypeOptions.filter(option =>
    option.value !== 'text' && option.value !== 'image' && option.value !== 'file' && option.value !== 'contact'
  );
  protected readonly mobileComposerMenuSections = computed<readonly MenuSection[]>(() => [
    {
      items: this.composerTypes.map(option => ({
        label: option.label,
        icon: option.icon,
        value: option.value,
        disabled: this.composerType() === option.value,
      })),
    },
  ]);

  private readonly rtfCache = new Map<string, Intl.RelativeTimeFormat>();
  private typingPresenceConversationId: string | null = null;

  protected readonly selectedConversation = computed(() => {
    const conversationId = this.selectedConversationId();
    if (!conversationId) {
      return null;
    }
    return this.conversations().find(item => item.id === conversationId) ?? null;
  });

  protected readonly showListPane = computed(() => !this.isMobileViewport() || this.selectedConversation() == null);
  protected readonly showThreadPane = computed(() => !this.isMobileViewport() || this.selectedConversation() != null);
  protected readonly showReactionDialog = computed(() => this.pendingReactionMessage() !== null);
  protected readonly showEditMessageDialog = computed(() => this.pendingEditMessage() !== null);
  protected readonly showDeleteMessageDialog = computed(() => this.pendingDeleteMessage() !== null);
  protected readonly showRevokeMessageDialog = computed(() => this.pendingRevokeMessage() !== null);
  protected readonly showDisappearingTimerDialog = computed(() => this.pendingDisappearingTimerConversationId() !== null);
  protected readonly showDeleteConversationDialog = computed(() => this.pendingDeleteConversationId() !== null);
  protected readonly canSend = computed(() => this.deviceStatus.canSend());
  protected readonly unreadConversationCount = computed(() => this.conversations().filter(item => this.isConversationVisibleInActiveList(item) && item.unreadCount > 0).length);
  protected readonly archivedConversationCount = computed(() => this.conversations().filter(item => this.isConversationArchived(item) && !this.isConversationDeleted(item)).length);
  protected readonly hasConversationSearch = computed(() => this.conversationSearchQuery().trim() !== '');
  protected readonly filteredConversations = computed(() => {
    const filter = this.conversationListFilter();
    const query = this.conversationSearchQuery().trim().toLowerCase();

    return this.conversations().filter(conversation => {
      if (this.isConversationDeleted(conversation)) {
        return false;
      }

      if (filter === 'archived') {
        if (!this.isConversationArchived(conversation)) {
          return false;
        }
      } else if (this.isConversationArchived(conversation)) {
        return false;
      }

      if (filter === 'unread' && conversation.unreadCount === 0) {
        return false;
      }

      if (query === '') {
        return true;
      }

      const haystack = [
        this.displayName(conversation),
        conversation.phoneNumber,
        conversation.lastMessagePreview,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });
  protected readonly canSuggestReply = computed(() => {
    const conversation = this.selectedConversation();
    return !!conversation?.leadId && !this.loadingMessages() && !this.sendingMessage() && !this.suggestingReply();
  });
  protected readonly showSuggestionScenarioNotes = computed(() => isNonGenericReplyScenario(this.suggestionScenario()));
  protected readonly conversationLinkedLead = computed(() => this.selectedConversation()?.linkedLead ?? null);
  protected readonly conversationSuggestedLead = computed(() => this.conversationLinkedLead() ? null : (this.selectedConversation()?.suggestedLead ?? null));
  protected readonly canUseLeadActions = computed(() => !!this.selectedConversation()?.leadId);
  protected readonly canCreateConversationLead = computed(() => {
    return !!this.selectedConversation()
      && this.createLeadFirstName().trim() !== ''
      && this.createLeadLastName().trim() !== ''
      && this.createLeadStreet().trim() !== ''
      && this.createLeadHouseNumber().trim() !== ''
      && this.createLeadZipCode().trim() !== ''
      && this.createLeadCity().trim() !== ''
      && this.createLeadServiceType().trim() !== ''
      && this.leadRelationshipBusy() !== 'create';
  });
  protected readonly selectedImportantCount = computed(() => this.selectedImportantMessageIds().length);
  protected readonly linkedLeadServiceOptions = computed<SelectOption<string>[]>(() => {
    const lead = this.linkedLead();
    if (!lead?.services?.length) {
      return [];
    }
    return lead.services.map((service: LeadService) => ({
      label: this.describeLinkedLeadService(service),
      value: service.id,
    }));
  });
  protected readonly showLinkedLeadServicePicker = computed(() => this.linkedLeadServiceOptions().length > 1);
  protected readonly isUploadComposer = computed(() => this.isUploadType(this.composerType()));
  protected readonly showCaptionComposer = computed(() => {
    const type = this.composerType();
    return type === 'image' || type === 'video' || type === 'file';
  });
  protected readonly showAdvancedComposerOptions = computed(() => {
    const activeType = this.composerType();
    return this.composerOptionsExpanded() || this.advancedComposerTypes.some(option => option.value === activeType);
  });
  protected readonly hasActiveAISuggestion = computed(() => {
    const conversationId = this.selectedConversationId();
    const aiSuggestion = this.aiSuggestionSeed();
    return this.composerType() === 'text'
      && conversationId !== null
      && aiSuggestion !== null
      && this.aiSuggestionConversationId() === conversationId;
  });
  protected readonly willLearnEditedAISuggestion = computed(() => {
    if (!this.hasActiveAISuggestion()) {
      return false;
    }
    const aiSuggestion = this.aiSuggestionSeed()?.trim() ?? '';
    const currentBody = this.composerBody().trim();
    return currentBody !== '' && currentBody !== aiSuggestion;
  });
  protected readonly composerValidationMessage = computed(() => this.getComposerValidationMessage());
  protected readonly canSubmitComposer = computed(() => {
    return this.canSend() && !this.sendingMessage() && !this.composerIsEncodingAttachment() && this.composerValidationMessage() === null;
  });
  protected readonly deleteMessageDialogDescription = computed(() => {
    const message = this.pendingDeleteMessage();
    if (!message) {
      return '';
    }

    const preview = this.deleteMessagePreview(message);
    return preview === ''
      ? 'Dit bericht wordt alleen uit jouw inbox verwijderd.'
      : `Dit bericht wordt alleen uit jouw inbox verwijderd: "${preview}"`;
  });
  protected readonly revokeMessageDialogDescription = computed(() => {
    const message = this.pendingRevokeMessage();
    if (!message) {
      return '';
    }

    const preview = this.deleteMessagePreview(message);
    return preview === ''
      ? 'Dit bericht wordt voor iedereen ingetrokken.'
      : `Dit bericht wordt voor iedereen ingetrokken: "${preview}"`;
  });
  protected readonly canConfirmReaction = computed(() => {
    return this.pendingReactionMessage() !== null && this.reactingMessageId() === null && this.reactionDraft().trim() !== '';
  });
  protected readonly canConfirmDisappearingTimer = computed(() => {
    return this.pendingDisappearingTimerConversationId() !== null && this.togglingConversationAction() === null;
  });
  protected readonly canConfirmEditMessage = computed(() => {
    const pendingMessage = this.pendingEditMessage();
    if (!pendingMessage || this.editingMessageId() !== null) {
      return false;
    }

    const draft = this.editMessageDraft().trim();
    const original = this.editableMessageBody(pendingMessage);
    return draft !== '' && original !== null && draft !== original;
  });

  constructor() {
    if (globalThis.window !== undefined) {
      const mediaQuery = globalThis.window.matchMedia('(max-width: 1023px)');
      const syncViewport = () => this.isMobileViewport.set(mediaQuery.matches);
      syncViewport();
      mediaQuery.addEventListener('change', syncViewport);
      this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', syncViewport));
    }

    this.deviceStatus.startPolling();
    this.loadServiceTypes();
    this.loadConversations();
    this.subscribeToRealtimeEvents();
  }

  protected loadServiceTypes(): void {
    this.serviceTypesService.listActive()
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.availableServiceTypes.set(response.items ?? []);
        const firstItem = response.items[0];
        if (!this.createLeadServiceType() && firstItem) {
          this.createLeadServiceType.set(firstItem.name);
        }
      });
  }

  protected loadConversations(): void {
    this.loadingConversations.set(true);
    this.errorMessage.set(null);
    this.inbox.listConversations()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.loadingConversations.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ conversations }) => {
        this.conversations.set(conversations);
        this.unreadCount.refresh();
        const selectedConversationId = this.selectedConversationId();
        if (selectedConversationId && conversations.some(item => item.id === selectedConversationId && !this.isConversationDeleted(item))) {
          return;
        }

        const firstConversation = conversations.find(item => this.isConversationVisibleInActiveList(item));
        if (firstConversation) {
          this.selectConversation(firstConversation.id);
        } else {
          this.selectedConversationId.set(null);
          this.messages.set([]);
        }
      });
  }

  protected selectConversation(conversationId: string): void {
    if (this.selectedConversationId() === conversationId) {
      return;
    }

    this.stopTypingPresence();
    this.importantSelectionMode.set(false);
    this.selectedImportantMessageIds.set([]);
    this.resetConversationLeadPanels();
    this.resetLinkedLeadState();
    this.selectedConversationId.set(conversationId);
    this.loadMessages(conversationId);
  }

  protected closeConversation(): void {
    this.stopTypingPresence();
    this.importantSelectionMode.set(false);
    this.selectedImportantMessageIds.set([]);
    this.resetConversationLeadPanels();
    this.resetLinkedLeadState();
    this.selectedConversationId.set(null);
    this.messages.set([]);
  }

  protected toggleLeadSearchPanel(): void {
    const nextValue = !this.showLeadSearchPanel();
    this.showLeadSearchPanel.set(nextValue);
    if (nextValue) {
      this.showCreateLeadPanel.set(false);
    }
  }

  protected openCreateLeadPanel(): void {
    this.prefillCreateLeadFromConversation();
    this.showCreateLeadPanel.set(true);
    this.showLeadSearchPanel.set(false);
  }

  protected closeCreateLeadPanel(): void {
    this.showCreateLeadPanel.set(false);
  }

  protected searchExistingLeads(): void {
    const query = this.leadSearchQuery().trim();
    if (query.length < 2) {
      this.leadSearchResults.set([]);
      return;
    }

    this.leadSearchLoading.set(true);
    this.leads.list({ search: query, pageSize: 6 })
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.leadSearchLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => this.leadSearchResults.set(response.items ?? []));
  }

  protected linkSuggestedLead(): void {
    const suggestedLead = this.conversationSuggestedLead();
    if (!suggestedLead) {
      return;
    }
    this.linkConversationLead(suggestedLead.id);
  }

  protected linkConversationLead(leadId: string): void {
    const conversation = this.selectedConversation();
    if (!conversation || !leadId || this.leadRelationshipBusy()) {
      return;
    }

    const payload: LinkWhatsAppConversationLeadRequest = { leadId };
    this.leadRelationshipBusy.set('link');
    this.inbox.linkConversationLead(conversation.id, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.leadRelationshipBusy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.applyConversationActionResponse(response);
        this.loadLinkedLead(response.conversation.leadId ?? null);
        this.showLeadSearchPanel.set(false);
        this.leadSearchResults.set([]);
        this.toast.success('WhatsApp-gesprek gekoppeld aan lead.');
      });
  }

  protected unlinkConversationLead(): void {
    const conversation = this.selectedConversation();
    if (!conversation?.leadId || this.leadRelationshipBusy()) {
      return;
    }

    this.leadRelationshipBusy.set('unlink');
    this.inbox.unlinkConversationLead(conversation.id)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.leadRelationshipBusy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.applyConversationActionResponse(response);
        this.resetLinkedLeadState();
        this.toast.success('WhatsApp-gesprek ontkoppeld van lead.');
      });
  }

  protected createLeadFromConversation(): void {
    const conversation = this.selectedConversation();
    if (!conversation || !this.canCreateConversationLead()) {
      return;
    }

    const payload: CreateLeadRequest = {
      firstName: this.createLeadFirstName().trim(),
      lastName: this.createLeadLastName().trim(),
      phone: conversation.phoneNumber,
      consumerRole: this.createLeadConsumerRole(),
      street: this.createLeadStreet().trim(),
      houseNumber: this.createLeadHouseNumber().trim(),
      zipCode: this.createLeadZipCode().trim(),
      city: this.createLeadCity().trim(),
      serviceType: this.createLeadServiceType().trim(),
      source: 'whatsapp_inbox',
      whatsappOptedIn: true,
      ...(this.createLeadEmail().trim() ? { email: this.createLeadEmail().trim() } : {}),
    };

    this.leadRelationshipBusy.set('create');
    this.inbox.createLeadFromConversation(conversation.id, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.leadRelationshipBusy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.applyConversationActionResponse(response);
        this.loadLinkedLead(response.conversation.leadId ?? null);
        this.showCreateLeadPanel.set(false);
        this.toast.success('Lead aangemaakt vanuit WhatsApp inbox.');
      });
  }

  protected updateLinkedLeadServiceId(value: string | null): void {
    this.linkedLeadServiceId.set(value || null);
  }

  protected startTypingPresence(): void {
    const conversation = this.selectedConversation();
    if (!conversation || !this.canSend() || this.typingPresenceConversationId === conversation.id) {
      return;
    }

    this.typingPresenceConversationId = conversation.id;
    this.inbox.sendChatPresence(conversation.id, { action: 'start' })
      .pipe(
        catchError(() => {
          this.typingPresenceConversationId = null;
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected stopTypingPresence(): void {
    const conversationId = this.typingPresenceConversationId;
    if (!conversationId) {
      return;
    }

    this.typingPresenceConversationId = null;
    this.inbox.sendChatPresence(conversationId, { action: 'stop' })
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected sendMessage(): void {
    const conversation = this.selectedConversation();
    if (!conversation || this.sendingMessage() || !this.canSend() || this.composerIsEncodingAttachment()) {
      return;
    }

    const validationMessage = this.composerValidationMessage();
    if (validationMessage) {
      this.toast.error(validationMessage);
      return;
    }

    const payload = this.buildComposerPayload();
    if (!payload) {
      this.toast.error('WhatsApp-bericht kon niet worden opgebouwd.');
      return;
    }

    this.stopTypingPresence();
    this.sendingMessage.set(true);
    this.inbox.sendConversationMessage(conversation.id, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.sendingMessage.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ conversation: updatedConversation, message }) => {
        this.resetComposerState();
        this.upsertConversation(updatedConversation);
        this.upsertMessage(message);
      });
  }

  protected suggestReply(): void {
    const conversation = this.selectedConversation();
    if (!conversation?.leadId || this.suggestingReply()) {
      return;
    }

    this.suggestingReply.set(true);
    const scenarioNotes = this.suggestionScenarioNotes().trim();
    const request = scenarioNotes
      ? { scenario: this.suggestionScenario(), scenarioNotes }
      : { scenario: this.suggestionScenario() };
    this.inbox.suggestReply(conversation.id, request)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.suggestingReply.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ suggestion }) => {
        this.resetComposerState('text');
        this.composerBody.set(suggestion);
        this.aiSuggestionSeed.set(suggestion);
        this.aiSuggestionConversationId.set(conversation.id);
      });
  }

  protected setComposerType(type: WhatsAppMessageComposerType): void {
    if (this.composerType() === type) {
      return;
    }

    this.stopTypingPresence();
    if (this.advancedComposerTypes.some(option => option.value === type)) {
      this.composerOptionsExpanded.set(true);
    }
    this.resetComposerState(type);
  }

  protected toggleComposerOptions(): void {
    this.composerOptionsExpanded.update(expanded => !expanded);
  }

  protected onComposerMenuItemSelected(item: MenuItem): void {
    const type = this.composerMenuItemValue(item);
    if (!type) {
      return;
    }

    this.setComposerType(type);
  }

  protected clearConversationSearch(): void {
    this.conversationSearchQuery.set('');
  }

  protected messageMenuSections(message: WhatsAppMessage): readonly MenuSection[] {
    const items: MenuItem[] = [];
    if (this.canAttachMessageToLead(message)) {
      items.push({
        label: 'Koppel foto aan lead',
        icon: 'paperclip',
        value: 'attach-to-lead',
      });
    }
    if (!this.isReactionDisabled(message)) {
      items.push({
        label: 'Reageer',
        icon: 'smile-plus',
        value: 'react',
      });
    }
    if (!this.isEditMessageDisabled(message)) {
      items.push({
        label: 'Bewerk bericht',
        icon: 'pencil',
        value: 'edit',
      });
    }
    if (!this.isDeleteMessageDisabled(message)) {
      items.push({
        label: 'Verwijder voor mij',
        icon: 'trash-2',
        value: 'delete',
      });
    }
    if (!this.isRevokeMessageDisabled(message)) {
      items.push({
        label: 'Trek in voor iedereen',
        icon: 'undo-2',
        value: 'revoke',
      });
    }
    if (!this.isStarMessageDisabled(message)) {
      items.push({
        label: this.isMessageStarred(message) ? 'Verwijder ster' : 'Markeer met ster',
        icon: 'star',
        value: 'star',
      });
    }
    if (!this.isDownloadMessageDisabled(message)) {
      items.push({
        label: 'Download media',
        icon: 'download',
        value: 'download',
      });
    }

    if (items.length === 0) {
      return [];
    }

    return [
      {
        items,
      },
    ];
  }

  protected onMessageMenuItemSelected(message: WhatsAppMessage, item: MenuItem): void {
    if (item.value === 'react') {
      this.requestReaction(message);
      return;
    }
    if (item.value === 'edit') {
      this.requestEditMessage(message);
      return;
    }
    if (item.value === 'delete') {
      this.requestDeleteMessage(message);
      return;
    }
    if (item.value === 'revoke') {
      this.requestRevokeMessage(message);
      return;
    }
    if (item.value === 'star') {
      this.toggleMessageStar(message);
      return;
    }
    if (item.value === 'download') {
      this.downloadMessageMedia(message);
      return;
    }
    if (item.value === 'attach-to-lead') {
      this.attachMessageToLead(message);
    }
  }

  protected threadMenuSections(): readonly MenuSection[] {
    const conversation = this.selectedConversation();
    if (!conversation) {
      return [];
    }

    const state = this.threadState(conversation.id);
    const sections: MenuSection[] = [
      {
        items: [
          {
            label: this.isConversationArchived(conversation) ? 'Haal uit archief' : 'Archiveer gesprek',
            icon: 'archive',
            value: this.isConversationArchived(conversation) ? 'unarchive' : 'archive',
            disabled: this.isConversationActionBusy(),
          },
          {
            label: state.pinned ? 'Maak los' : 'Zet vast',
            icon: 'pin',
            value: state.pinned ? 'unpin' : 'pin',
            disabled: this.isConversationActionBusy(),
          },
          {
            label: 'Verwijder chat',
            icon: 'trash-2',
            value: 'delete-chat',
            disabled: this.isConversationActionBusy(),
          },
        ],
      },
      {
        label: 'Verdwijnende berichten',
        items: this.disappearingTimerOptions.map(option => ({
          label: option.label,
          icon: 'clock',
          value: `timer:${option.value}`,
          disabled: this.isConversationActionBusy() || state.timerSeconds === option.value,
        })),
      },
    ];

    if (conversation.leadId) {
      sections.unshift({
        items: [
          {
            label: this.importantSelectionMode() ? 'Stop selectie belangrijke berichten' : 'Selecteer belangrijke berichten',
            icon: this.importantSelectionMode() ? 'x' : 'check-check',
            value: 'toggle-important-selection',
            disabled: this.savingImportantMessages(),
          },
          {
            label: 'Sla geselecteerde berichten op',
            icon: 'bookmark-plus',
            value: 'save-important-messages',
            disabled: !this.importantSelectionMode() || this.selectedImportantCount() === 0 || this.savingImportantMessages(),
          },
        ],
      });
    }

    return sections;
  }

  protected onThreadMenuItemSelected(item: MenuItem): void {
    const conversation = this.selectedConversation();
    if (!conversation || this.isConversationActionBusy()) {
      return;
    }

    if (item.value === 'archive') {
      this.setConversationArchived(conversation.id, true);
      return;
    }
    if (item.value === 'unarchive') {
      this.setConversationArchived(conversation.id, false);
      return;
    }
    if (item.value === 'pin') {
      this.setConversationPinned(conversation.id, true);
      return;
    }
    if (item.value === 'unpin') {
      this.setConversationPinned(conversation.id, false);
      return;
    }
    if (item.value === 'delete-chat') {
      this.requestDeleteConversation(conversation.id);
      return;
    }
    if (item.value === 'toggle-important-selection') {
      this.toggleImportantSelectionMode();
      return;
    }
    if (item.value === 'save-important-messages') {
      this.saveSelectedMessagesToLead();
      return;
    }
    if (item.value?.startsWith('timer:')) {
      const timerValue = Number(item.value.slice('timer:'.length));
      if (!Number.isNaN(timerValue)) {
        this.requestDisappearingTimer(conversation.id, timerValue);
      }
    }
  }

  protected requestDisappearingTimer(conversationId: string, timerSeconds: number): void {
    this.pendingDisappearingTimerConversationId.set(conversationId);
    this.disappearingTimerDraft.set(timerSeconds);
  }

  protected updateDisappearingTimerDraft(value: number): void {
    this.disappearingTimerDraft.set(value);
  }

  protected cancelDisappearingTimer(): void {
    if (this.isConversationActionBusy()) {
      return;
    }

    this.pendingDisappearingTimerConversationId.set(null);
  }

  protected requestDeleteConversation(conversationId: string): void {
    this.pendingDeleteConversationId.set(conversationId);
  }

  protected cancelDeleteConversation(): void {
    if (this.isConversationActionBusy()) {
      return;
    }

    this.pendingDeleteConversationId.set(null);
  }

  protected confirmDeleteConversation(): void {
    const conversationId = this.pendingDeleteConversationId();
    if (!conversationId || this.isConversationActionBusy()) {
      return;
    }

    this.togglingConversationAction.set(conversationId);
    this.inbox.deleteConversation(conversationId)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.togglingConversationAction.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: WhatsAppConversationActionResponse) => {
        this.pendingDeleteConversationId.set(null);
        this.applyConversationActionResponse(response);
        this.toast.success('Chat verwijderd uit de inbox.');
      });
  }

  protected confirmDisappearingTimer(): void {
    const conversationId = this.pendingDisappearingTimerConversationId();
    if (!conversationId || this.isConversationActionBusy()) {
      return;
    }

    this.setConversationDisappearingTimer(conversationId, this.disappearingTimerDraft());
  }

  protected quickReact(message: WhatsAppMessage, emoji: string): void {
    if (this.isReactionDisabled(message)) {
      return;
    }

    this.submitReaction(message, emoji.trim());
  }

  protected requestReaction(message: WhatsAppMessage): void {
    if (this.isReactionDisabled(message)) {
      return;
    }

    this.pendingReactionMessage.set(message);
    this.reactionDraft.set(this.currentReactionForMessage(message) ?? '');
  }

  protected selectReaction(emoji: string): void {
    this.reactionDraft.set(emoji);
  }

  protected updateReactionDraft(value: string): void {
    this.reactionDraft.set(value);
  }

  protected cancelReaction(): void {
    if (this.reactingMessageId() !== null) {
      return;
    }

    this.pendingReactionMessage.set(null);
    this.reactionDraft.set('');
  }

  protected confirmReaction(): void {
    const message = this.pendingReactionMessage();
    const emoji = this.reactionDraft().trim();
    if (!message || emoji === '') {
      return;
    }

    this.submitReaction(message, emoji, () => {
      this.pendingReactionMessage.set(null);
      this.reactionDraft.set('');
      this.toast.success('Reactie toegevoegd.');
    });
  }

  protected requestEditMessage(message: WhatsAppMessage): void {
    if (this.isEditMessageDisabled(message)) {
      return;
    }

    const editableBody = this.editableMessageBody(message);
    if (editableBody === null) {
      return;
    }

    this.pendingEditMessage.set(message);
    this.editMessageDraft.set(editableBody);
  }

  protected updateEditMessageDraft(value: string): void {
    this.editMessageDraft.set(value);
  }

  protected cancelEditMessage(): void {
    if (this.editingMessageId() !== null) {
      return;
    }

    this.pendingEditMessage.set(null);
    this.editMessageDraft.set('');
  }

  protected confirmEditMessage(): void {
    const conversationId = this.selectedConversationId();
    const message = this.pendingEditMessage();
    const messageTarget = this.actionMessageTarget(message);
    const body = this.editMessageDraft().trim();
    if (!conversationId || !message || !messageTarget || this.editingMessageId() !== null) {
      return;
    }

    const original = this.editableMessageBody(message);
    if (!original || body === '' || body === original) {
      return;
    }

    this.editingMessageId.set(message.id);
    const payload: EditWhatsAppMessageRequest = { body };
    this.inbox.editMessage(conversationId, messageTarget, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.editingMessageId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.pendingEditMessage.set(null);
        this.editMessageDraft.set('');
        this.applyConversationActionResponse(response);
        this.toast.success('Bericht bijgewerkt.');
      });
  }

  protected requestDeleteMessage(message: WhatsAppMessage): void {
    if (this.isDeleteMessageDisabled(message)) {
      return;
    }

    this.pendingDeleteMessage.set(message);
  }

  protected cancelDeleteMessage(): void {
    if (this.deletingMessageId() !== null) {
      return;
    }

    this.pendingDeleteMessage.set(null);
  }

  protected confirmDeleteMessage(): void {
    const conversationId = this.selectedConversationId();
    const message = this.pendingDeleteMessage();
    const messageTarget = this.actionMessageTarget(message);
    if (!conversationId || !message || !messageTarget || this.deletingMessageId() !== null) {
      return;
    }

    this.deletingMessageId.set(message.id);
    this.inbox.deleteMessage(conversationId, messageTarget)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.deletingMessageId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.pendingDeleteMessage.set(null);
        this.applyConversationActionResponse(response);
        this.toast.success('Bericht verwijderd uit jouw inbox.');
      });
  }

  protected requestRevokeMessage(message: WhatsAppMessage): void {
    if (this.isRevokeMessageDisabled(message)) {
      return;
    }

    this.pendingRevokeMessage.set(message);
  }

  protected cancelRevokeMessage(): void {
    if (this.revokingMessageId() !== null) {
      return;
    }

    this.pendingRevokeMessage.set(null);
  }

  protected confirmRevokeMessage(): void {
    const conversationId = this.selectedConversationId();
    const message = this.pendingRevokeMessage();
    const messageTarget = this.actionMessageTarget(message);
    if (!conversationId || !message || !messageTarget || this.revokingMessageId() !== null) {
      return;
    }

    this.revokingMessageId.set(message.id);
    this.inbox.revokeMessage(conversationId, messageTarget)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.revokingMessageId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.pendingRevokeMessage.set(null);
        this.applyConversationActionResponse(response);
        this.toast.success('Bericht ingetrokken voor iedereen.');
      });
  }

  protected async handleAttachmentSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.item(0);
    if (!file) {
      this.clearComposerAttachment();
      return;
    }

    this.composerIsEncodingAttachment.set(true);
    try {
      const base64Data = await this.readFileAsBase64(file);
      this.composerAttachmentName.set(file.name);
      this.composerAttachmentBase64.set(base64Data);
    } catch {
      this.clearComposerAttachment();
      this.toast.error('Bestand kon niet worden ingelezen.');
    } finally {
      this.composerIsEncodingAttachment.set(false);
      if (input) {
        input.value = '';
      }
    }
  }

  protected clearComposerAttachment(): void {
    this.composerAttachmentName.set(null);
    this.composerAttachmentBase64.set(null);
  }

  protected uploadAccept(): string {
    switch (this.composerType()) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'audio':
        return 'audio/*';
      case 'sticker':
        return 'image/webp,image/*';
      default:
        return '*/*';
    }
  }

  protected composerHelperText(): string {
    if (this.suggestingReply()) {
      return 'AI-suggestie wordt gegenereerd.';
    }
    if (!this.canSend()) {
      return 'Berichten verzenden is tijdelijk niet beschikbaar.';
    }
    if (this.composerIsEncodingAttachment()) {
      return 'Bestand wordt voorbereid voor verzending.';
    }
    return this.composerValidationMessage() ?? 'Verstuurt direct via het gekoppelde WhatsApp-apparaat.';
  }

  protected aiLearningIndicatorText(): string {
    if (!this.hasActiveAISuggestion()) {
      return '';
    }
    if (this.willLearnEditedAISuggestion()) {
      return 'Deze aangepaste AI-reply wordt na verzenden meegenomen als feedback voor volgende suggesties.';
    }
    return 'AI-suggestie geladen. Pas het bericht aan als je wilt dat jouw correctie wordt meegenomen in volgende suggesties.';
  }

  protected sendButtonLabel(): string {
    if (this.sendingMessage()) {
      return 'Versturen...';
    }

    switch (this.composerType()) {
      case 'poll':
        return 'Verstuur poll';
      case 'contact':
        return 'Verstuur contact';
      case 'location':
        return 'Verstuur locatie';
      default:
        return 'Verstuur';
    }
  }

  protected setPresence(type: WhatsAppPresenceType): void {
    if (!this.canSend() || this.sendingPresence() !== null || this.isPresenceSelected(type)) {
      return;
    }

    this.sendingPresence.set(type);
    this.inbox.sendPresence({ type })
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.sendingPresence.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.deviceStatus.refresh();
      });
  }

  protected togglePresence(): void {
    this.setPresence(this.isPresenceSelected('available') ? 'unavailable' : 'available');
  }

  protected presenceToggleIcon(): string {
    return this.isPresenceSelected('available') ? 'radio' : 'moon-star';
  }

  protected presenceToggleTitle(): string {
    return this.isPresenceSelected('available') ? 'Online' : 'Afwezig';
  }

  protected presenceToggleAriaLabel(): string {
    return this.isPresenceSelected('available')
      ? 'WhatsApp staat op Online. Zet op Afwezig'
      : 'WhatsApp staat op Afwezig. Zet op Online';
  }

  protected relativeTime(timestamp: string): string {
    const language = this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'en';
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.max(1, Math.floor(diff / 1000));

    if (seconds < 60) {
      return language === 'nl' ? 'nu' : 'now';
    }

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const locale = language === 'nl' ? 'nl-NL' : 'en-US';

    let formatter = this.rtfCache.get(locale);
    if (!formatter) {
      formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      this.rtfCache.set(locale, formatter);
    }

    if (minutes < 60) {
      return formatter.format(-minutes, 'minute');
    }

    if (hours < 24) {
      return formatter.format(-hours, 'hour');
    }

    return formatter.format(-days, 'day');
  }

  protected displayName(conversation: WhatsAppConversation): string {
    const name = conversation.displayName.trim();
    if (name !== '') {
      return name;
    }
    return conversation.phoneNumber;
  }

  protected conversationInitial(conversation: WhatsAppConversation): string {
    const label = this.displayName(conversation).trim();
    const character = Array.from(label).find(value => /[\p{L}\p{N}]/u.test(value));
    return (character ?? '#').toUpperCase();
  }

  protected conversationPreview(conversation: WhatsAppConversation): string {
    const preview = conversation.lastMessagePreview.trim();
    return preview === '' ? 'Geen berichtinhoud' : preview;
  }

  protected conversationDirectionLabel(conversation: WhatsAppConversation): string {
    return conversation.lastMessageDirection === 'outbound' ? 'Uitgaand' : 'Inkomend';
  }

  protected conversationDirectionIcon(conversation: WhatsAppConversation): string {
    return conversation.lastMessageDirection === 'outbound' ? 'arrow-up-right' : 'arrow-down-left';
  }

  protected composerTypeLabel(): string {
    return this.composerTypes.find(option => option.value === this.composerType())?.label ?? 'Bericht';
  }

  protected mobileComposerMenuLabel(): string {
    return this.composerType() === 'text' ? 'Meer berichtopties' : `${this.composerTypeLabel()} kiezen`;
  }

  protected composerOptionsToggleLabel(): string {
    return this.showAdvancedComposerOptions() ? 'Minder opties' : 'Meer opties';
  }

  protected isPresenceSelected(type: WhatsAppPresenceType): boolean {
    return this.deviceStatus.currentPresence() === type;
  }

  protected messageMutationBadges(message: WhatsAppMessage): MessageMutationBadge[] {
    const portal = this.messagePortalMetadata(message);
    if (!portal) {
      return [];
    }

    const badges: MessageMutationBadge[] = [];
    if (portal.deleted) {
      badges.push({ key: 'deleted', kind: 'deleted', icon: 'trash-2', label: 'Verwijderd' });
    }
    if (portal.revoked) {
      badges.push({ key: 'revoked', kind: 'revoked', icon: 'rotate-ccw', label: 'Ingetrokken' });
    }
    if (portal.edited) {
      badges.push({ key: 'edited', kind: 'edited', icon: 'pencil', label: 'Bewerkt' });
    }
    return badges;
  }

  protected messageReactionSummaries(message: WhatsAppMessage): MessageReactionSummary[] {
    const reactions = this.messagePortalMetadata(message)?.reactions ?? [];
    const grouped = new Map<string, { count: number; actors: string[] }>();

    for (const reaction of reactions) {
      const emoji = reaction.reaction?.trim();
      if (!emoji) {
        continue;
      }

      const actor = reaction.actorName?.trim() || reaction.actorJid?.trim() || 'Onbekend';
      const current = grouped.get(emoji);
      if (current) {
        current.count += 1;
        current.actors.push(actor);
      } else {
        grouped.set(emoji, { count: 1, actors: [actor] });
      }
    }

    return Array.from(grouped.entries()).map(([reaction, entry]) => ({
      key: reaction,
      reaction,
      count: entry.count,
      tooltip: entry.actors.join(', '),
    }));
  }

  protected isMessageRemoved(message: WhatsAppMessage): boolean {
    const portal = this.messagePortalMetadata(message);
    return !!portal?.deleted || !!portal?.revoked;
  }

  protected mutationBadgeClass(message: WhatsAppMessage, badge: MessageMutationBadge): string {
    const outbound = message.direction === 'outbound';
    switch (badge.kind) {
      case 'deleted':
        return outbound ? 'bg-rose-500/25 text-rose-50' : 'bg-rose-100 text-rose-700';
      case 'revoked':
        return outbound ? 'bg-orange-500/25 text-orange-50' : 'bg-orange-100 text-orange-700';
      default:
        return outbound ? 'bg-sky-500/25 text-sky-50' : 'bg-sky-100 text-sky-700';
    }
  }

  protected messageBodyClass(message: WhatsAppMessage): string {
    const portal = this.messagePortalMetadata(message);
    if (portal?.deleted) {
      return message.direction === 'outbound' ? 'italic text-rose-50/90' : 'italic text-rose-700';
    }
    if (portal?.revoked) {
      return message.direction === 'outbound' ? 'italic text-orange-50/90' : 'italic text-orange-700';
    }
    if (portal?.edited) {
      return message.direction === 'outbound' ? 'text-white' : 'text-zinc-900';
    }
    return message.direction === 'outbound' ? 'text-white' : 'text-zinc-900';
  }

  protected reactionChipClass(message: WhatsAppMessage): string {
    return message.direction === 'outbound'
      ? 'bg-white/12 text-white ring-1 ring-inset ring-white/20'
      : 'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200';
  }

  protected shouldShowMessageActions(message: WhatsAppMessage): boolean {
    return this.messageMenuSections(message).some(section => section.items.length > 0);
  }

  protected isAttachingMessage(message: WhatsAppMessage): boolean {
    return this.attachingMessageId() === message.id;
  }

  protected isImportantSelectionEnabled(): boolean {
    return this.importantSelectionMode();
  }

  protected isMessageSelectedAsImportant(message: WhatsAppMessage): boolean {
    return this.selectedImportantMessageIds().includes(message.id);
  }

  protected canToggleImportantSelection(message: WhatsAppMessage): boolean {
    return !!this.selectedConversation()?.leadId && this.actionMessageTarget(message) !== null;
  }

  protected toggleImportantSelectionMode(): void {
    const nextValue = !this.importantSelectionMode();
    this.importantSelectionMode.set(nextValue);
    if (!nextValue) {
      this.selectedImportantMessageIds.set([]);
    }
  }

  protected toggleMessageImportantSelection(message: WhatsAppMessage): void {
    if (!this.importantSelectionMode() || !this.canToggleImportantSelection(message) || this.savingImportantMessages()) {
      return;
    }

    this.selectedImportantMessageIds.update(items => items.includes(message.id)
      ? items.filter(item => item !== message.id)
      : [...items, message.id]);
  }

  protected saveSelectedMessagesToLead(): void {
    const conversation = this.selectedConversation();
    if (!conversation?.leadId || this.savingImportantMessages() || this.selectedImportantCount() === 0) {
      return;
    }

    const payload: SaveWhatsAppMessagesToLeadRequest = {
      messageIds: this.selectedImportantMessageIds()
        .map(messageId => this.messages().find(item => item.id === messageId))
        .filter((message): message is WhatsAppMessage => !!message)
        .map(message => this.actionMessageTarget(message))
        .filter((messageId): messageId is string => !!messageId),
    };
    const selectedServiceId = this.selectedLinkedLeadServiceId();
    if (selectedServiceId) {
      payload.serviceId = selectedServiceId;
    }
    if (payload.messageIds.length === 0) {
      this.toast.error('Geen geldige WhatsApp-berichten geselecteerd.');
      return;
    }

    this.savingImportantMessages.set(true);
    this.inbox.saveMessagesToLead(conversation.id, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.savingImportantMessages.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.selectedImportantMessageIds.set([]);
        this.importantSelectionMode.set(false);
        this.toast.success(`${response.savedCount} bericht${response.savedCount === 1 ? '' : 'en'} opgeslagen bij de lead.`);
      });
  }

  protected isReactingMessage(message: WhatsAppMessage): boolean {
    return this.reactingMessageId() === message.id;
  }

  protected isStarringMessage(message: WhatsAppMessage): boolean {
    return this.starringMessageId() === message.id;
  }

  protected isDownloadingMessage(message: WhatsAppMessage): boolean {
    return this.downloadingMessageId() === message.id;
  }

  protected isEditingMessage(message: WhatsAppMessage): boolean {
    return this.editingMessageId() === message.id;
  }

  protected isDeletingMessage(message: WhatsAppMessage): boolean {
    return this.deletingMessageId() === message.id;
  }

  protected isRevokingMessage(message: WhatsAppMessage): boolean {
    return this.revokingMessageId() === message.id;
  }

  protected originalMessageBody(message: WhatsAppMessage): string | null {
    const originalBody = this.messagePortalMetadata(message)?.originalBody?.trim();
    if (!originalBody || originalBody === message.body.trim()) {
      return null;
    }

    return originalBody;
  }

  protected messageReplyContext(message: WhatsAppMessage): MessageReplyContext | null {
  const portalReply = this.messagePortalMetadata(message)?.reply;
  const reply = this.normalizeReplyContext(portalReply);
  if (reply) {
    return reply;
  }

  const providerPayload = this.messageProviderPayload(message);
  const body = providerPayload?.quoted_body?.trim();
  if (!body) {
    return null;
  }

  return {
    body,
    ...(providerPayload?.replied_to_id?.trim() ? { messageId: providerPayload.replied_to_id.trim() } : {}),
  };
  }

  protected messageMedia(message: WhatsAppMessage): MessageMediaContent | null {
  const portal = this.messagePortalMetadata(message);
  const providerPayload = this.messageProviderPayload(message);
  const portalType = portal?.messageType?.trim();
  const messageType = portalType || this.providerMediaKind(providerPayload);
  if (!messageType || !this.isMediaMessageType(messageType)) {
    return null;
  }

  const attachment = portal?.attachment;
  const providerMedia = providerPayload ? this.providerMediaValue(providerPayload, messageType) : null;
  const filename = attachment?.filename?.trim() || this.providerMediaFilename(providerMedia);
  const url = this.normalizeMediaUrl(attachment?.remoteUrl || attachment?.path || this.providerMediaUrl(providerMedia));
  const caption = portal?.caption?.trim() || this.providerMediaCaption(providerMedia);
  const label = this.mediaLabel(messageType);
  return {
    kind: messageType,
    label,
    url,
    caption,
    filename,
    placeholder: filename ? `${label} ${filename}` : label,
  };
  }

  protected messageContacts(message: WhatsAppMessage): MessageContactCard[] {
  const portal = this.messagePortalMetadata(message);
  const portalContacts = this.normalizePortalContacts(portal);
  if (portalContacts.length > 0) {
    return portalContacts;
  }

  const payload = this.messageProviderPayload(message);
  const contacts: MessageContactCard[] = [];
  const singleContact = payload?.contact;
  if (singleContact) {
    const normalized = this.normalizeProviderContact(singleContact.displayName, singleContact.vcard);
    if (normalized) {
    contacts.push(normalized);
    }
  }
  for (const contact of payload?.contacts_array ?? []) {
    const normalized = this.normalizeProviderContact(contact.displayName, contact.vcard);
    if (normalized) {
    contacts.push(normalized);
    }
  }
  return contacts;
  }

  protected messageLocation(message: WhatsAppMessage): MessageLocationCard | null {
  const portalLocation = this.normalizePortalLocation(this.messagePortalMetadata(message)?.location);
  if (portalLocation) {
    return portalLocation;
  }

  const payload = this.messageProviderPayload(message);
  if (!payload?.location && !payload?.live_location) {
    return null;
  }
  const source = payload.live_location ?? payload.location;
  if (!source) {
    return null;
  }
  return {
    ...(this.stringifyValue(source.degreesLatitude) ? { latitude: this.stringifyValue(source.degreesLatitude) } : {}),
    ...(this.stringifyValue(source.degreesLongitude) ? { longitude: this.stringifyValue(source.degreesLongitude) } : {}),
    ...(source.name?.trim() ? { name: source.name.trim() } : {}),
    ...(source.address?.trim() ? { address: source.address.trim() } : {}),
    ...(payload.live_location ? { live: true } : {}),
  };
  }

  protected messagePoll(message: WhatsAppMessage): MessagePollCard | null {
  const portalPoll = this.normalizePortalPoll(this.messagePortalMetadata(message)?.poll);
  if (portalPoll) {
    return portalPoll;
  }

  const payload = this.messageProviderPayload(message);
  if (!payload) {
    return null;
  }
  const question = payload.question?.trim() || this.recordString(payload.poll, 'question') || this.recordString(payload.poll_update, 'question');
  const options = this.normalizeStringList(payload.options);
  const selectedOptions = this.normalizeStringList(
    payload.selectedOptions ?? payload.selected_options ?? payload.selectedOptionNames ?? payload.selected_option_names
  );
  const maxAnswer = this.stringifyValue(payload.max_answer);
  if (!question && options.length === 0 && selectedOptions.length === 0 && !maxAnswer) {
    return null;
  }
  return {
    ...(question ? { question } : {}),
    options,
    selectedOptions,
    ...(maxAnswer ? { maxAnswer } : {}),
  };
  }

  protected messagePrimaryBody(message: WhatsAppMessage): string | null {
  const body = message.body.trim();
  if (!body) {
    return null;
  }

  const media = this.messageMedia(message);
  if (media && (body === media.placeholder || (media.caption && body === media.caption))) {
    return null;
  }

  const contacts = this.messageContacts(message);
  if (contacts.length > 0 && (body === '[Contact]' || body.startsWith('[Contact] ') || body === '[Contacten]' || body.startsWith('[Contacten] '))) {
    return null;
  }

  const location = this.messageLocation(message);
  if (location && (body === '[Locatie]' || body.startsWith('[Locatie] '))) {
    return null;
  }

  const poll = this.messagePoll(message);
  if (poll) {
    const normalizedQuestion = poll.question?.trim();
    if (body === '[Poll]' || (normalizedQuestion && (body === normalizedQuestion || body === `[Poll] ${normalizedQuestion}`))) {
    return null;
    }
  }

  return body;
  }

  protected locationMapsUrl(location: MessageLocationCard): string | null {
  if (!location.latitude || !location.longitude) {
    return null;
  }
  const coordinates = `${location.latitude},${location.longitude}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(coordinates)}`;
  }

  private loadMessages(conversationId: string): void {
    this.loadingMessages.set(true);
    this.inbox.getConversationMessages(conversationId)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.loadingMessages.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ conversation, messages }) => {
        this.upsertConversation(conversation);
        this.messages.set(messages);
        this.loadLinkedLead(conversation.leadId ?? null);
        if (conversation.unreadCount > 0) {
          this.markConversationRead(conversation.id);
        }
      });
  }

  private loadLinkedLead(leadId: string | null | undefined): void {
    const normalizedLeadId = leadId?.trim() || null;
    if (!normalizedLeadId) {
      this.resetLinkedLeadState();
      return;
    }
    if (this.linkedLead()?.id === normalizedLeadId) {
      return;
    }

    this.linkedLeadLoading.set(true);
    this.leads.getById(normalizedLeadId)
      .pipe(
        catchError(error => {
          this.resetLinkedLeadState();
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.linkedLeadLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(lead => {
        this.linkedLead.set(lead);
        this.linkedLeadServiceId.set(lead.currentService?.id ?? lead.services[0]?.id ?? null);
      });
  }

  private resetLinkedLeadState(): void {
    this.linkedLead.set(null);
    this.linkedLeadLoading.set(false);
    this.linkedLeadServiceId.set(null);
  }

  private selectedLinkedLeadServiceId(): string | undefined {
    const serviceId = this.linkedLeadServiceId()?.trim();
    return serviceId || undefined;
  }

  private describeLinkedLeadService(service: LeadService): string {
    const parts = [service.serviceType, service.pipelineStage.replaceAll('_', ' ')];
    return parts.filter(Boolean).join(' · ');
  }

  private markConversationRead(conversationId: string): void {
    this.inbox.markConversationRead(conversationId)
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.conversations.update(items => items.map(item => item.id === conversationId ? { ...item, unreadCount: 0 } : item));
        this.unreadCount.refresh();
      });
  }

  private subscribeToRealtimeEvents(): void {
    this.sse.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.handleRealtimeEvent(event));
  }

  private handleRealtimeEvent(event: SSEEvent): void {
    if (event.type !== 'whatsapp_message_sent' && event.type !== 'whatsapp_message_received' && event.type !== 'whatsapp_message_updated' && event.type !== 'whatsapp_conversation_updated') {
      return;
    }

    const payload = (event.data ?? {}) as WhatsAppConversationEventPayload & WhatsAppMessageEventPayload;
    if (payload.conversation && this.isConversationLike(payload.conversation)) {
      this.upsertConversation(payload.conversation);
    }
    if (payload.message && this.isMessageLike(payload.message)) {
      this.upsertMessage(payload.message);
    }
    if (event.type === 'whatsapp_message_received' && payload.message?.conversationId === this.selectedConversationId()) {
      this.markConversationRead(payload.message.conversationId);
    }
  }

  private upsertConversation(conversation: WhatsAppConversation): void {
    this.conversations.update(items => {
      if (conversation.deletedAt) {
        return items.filter(item => item.id !== conversation.id);
      }

      const next = [...items];
      const index = next.findIndex(item => item.id === conversation.id);
      if (index >= 0) {
        next[index] = { ...next[index], ...conversation };
      } else {
        next.unshift(conversation);
      }
      next.sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime());
      return next;
    });
  }

  private upsertMessage(message: WhatsAppMessage): void {
    if (message.conversationId !== this.selectedConversationId()) {
      return;
    }

    this.messages.update(items => {
      const next = [...items];
      const index = next.findIndex(item => item.id === message.id);
      if (index >= 0) {
        next[index] = { ...next[index], ...message };
      } else {
        next.push(message);
      }
      return next.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    });
  }

  private applyConversationActionResponse(response: WhatsAppConversationActionResponse): void {
    if (response.conversation) {
      if (response.conversation.id === this.selectedConversationId() && !this.isConversationVisibleInCurrentFilter(response.conversation)) {
        this.closeConversation();
      }
      this.upsertConversation(response.conversation);
    }
    if (response.message) {
      this.upsertMessage(response.message);
    }
  }

  private threadState(conversationId: string): ThreadActionState {
    return this.threadActionState()[conversationId] ?? {};
  }

  private setConversationArchived(conversationId: string, value: boolean): void {
    const payload: ToggleWhatsAppConversationStateRequest = { value };
    this.togglingConversationAction.set(conversationId);
    this.inbox.setConversationArchived(conversationId, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.togglingConversationAction.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.applyConversationActionResponse(response);
        this.toast.success(value ? 'Gesprek gearchiveerd.' : 'Gesprek uit archief gehaald.');
      });
  }

  private setConversationPinned(conversationId: string, value: boolean): void {
    const payload: ToggleWhatsAppConversationStateRequest = { value };
    this.togglingConversationAction.set(conversationId);
    this.inbox.setConversationPinned(conversationId, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.togglingConversationAction.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.applyConversationActionResponse(response);
        this.threadActionState.update(current => ({
          ...current,
          [conversationId]: { ...current[conversationId], pinned: value },
        }));
        this.toast.success(value ? 'Gesprek vastgezet.' : 'Gesprek losgemaakt.');
      });
  }

  private setConversationDisappearingTimer(conversationId: string, timerSeconds: number): void {
    const payload: SetWhatsAppDisappearingTimerRequest = { timerSeconds };
    this.togglingConversationAction.set(conversationId);
    this.inbox.setConversationDisappearingTimer(conversationId, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.togglingConversationAction.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.pendingDisappearingTimerConversationId.set(null);
        this.applyConversationActionResponse(response);
        this.threadActionState.update(current => ({
          ...current,
          [conversationId]: { ...current[conversationId], timerSeconds },
        }));
        this.toast.success(timerSeconds === 0 ? 'Verdwijnende berichten uitgeschakeld.' : 'Verdwijnende berichten bijgewerkt.');
      });
  }

  private submitReaction(message: WhatsAppMessage, emoji: string, onSuccess?: () => void): void {
    const conversationId = this.selectedConversationId();
    const messageTarget = this.actionMessageTarget(message);
    if (!conversationId || !messageTarget || this.reactingMessageId() !== null) {
      return;
    }

    this.reactingMessageId.set(message.id);
    const payload: ReactWhatsAppMessageRequest = { emoji };
    this.inbox.reactToMessage(conversationId, messageTarget, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.reactingMessageId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.applyConversationActionResponse(response);
        onSuccess?.();
      });
  }

  private toggleMessageStar(message: WhatsAppMessage): void {
    const conversationId = this.selectedConversationId();
    const messageTarget = this.actionMessageTarget(message);
    if (!conversationId || !messageTarget || this.isStarMessageDisabled(message)) {
      return;
    }

    const nextValue = !this.isMessageStarred(message);
    const payload: ToggleWhatsAppMessageStateRequest = { value: nextValue };
    this.starringMessageId.set(message.id);
    this.inbox.setMessageStarred(conversationId, messageTarget, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.starringMessageId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.applyConversationActionResponse(response);
        this.messages.update(items => items.map(item => {
          if (item.id !== message.id) {
            return item;
          }
          const metadata = item.metadata ?? {};
          const portal = metadata.portal ?? {};
          return {
            ...item,
            metadata: {
              ...metadata,
              portal: {
                ...portal,
                starred: nextValue,
              },
            },
          };
        }));
        this.toast.success(nextValue ? 'Bericht gemarkeerd met ster.' : 'Ster verwijderd van bericht.');
      });
  }

  private downloadMessageMedia(message: WhatsAppMessage): void {
    const conversationId = this.selectedConversationId();
    const messageTarget = this.actionMessageTarget(message);
    if (!conversationId || !messageTarget || this.isDownloadMessageDisabled(message)) {
      return;
    }

    this.downloadingMessageId.set(message.id);
    this.inbox.downloadMessageMedia(conversationId, messageTarget)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.downloadingMessageId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => this.openDownloadedMedia(response));
  }

  private attachMessageToLead(message: WhatsAppMessage): void {
    const conversation = this.selectedConversation();
    const messageTarget = this.actionMessageTarget(message);
    if (!conversation?.leadId || !messageTarget || !this.canAttachMessageToLead(message)) {
      return;
    }

    this.attachingMessageId.set(message.id);
    const payload: AttachWhatsAppMessageToLeadRequest = {};
    const selectedServiceId = this.selectedLinkedLeadServiceId();
    if (selectedServiceId) {
      payload.serviceId = selectedServiceId;
    }
    this.inbox.attachMessageToLead(conversation.id, messageTarget, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.attachingMessageId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success('WhatsApp-foto gekoppeld aan de lead en foto-analyse gestart.');
      });
  }

  private openDownloadedMedia(response: WhatsAppMediaDownloadResponse): void {
    const target = response.downloadUrl?.trim() || '';
    if (target) {
      globalThis.window?.open(target, '_blank', 'noopener');
      return;
    }
    this.toast.error('Geen download-URL ontvangen voor dit medium.');
  }

  protected messageStatusLabel(message: WhatsAppMessage): string {
    if (message.direction !== 'outbound') {
      return '';
    }

    switch (message.status) {
      case 'read':
        return 'Gelezen';
      case 'delivered':
        return 'Afgeleverd';
      case 'failed':
        return 'Mislukt';
      default:
        return 'Verzonden';
    }
  }

  protected messageStatusIcon(message: WhatsAppMessage): string {
    if (message.direction !== 'outbound') {
      return '';
    }

    switch (message.status) {
      case 'read':
        return 'check-check';
      case 'delivered':
        return 'check-check';
      case 'failed':
        return 'circle-alert';
      default:
        return 'check';
    }
  }

  private messagePortalMetadata(message: WhatsAppMessage): WhatsAppPortalMetadata | null {
    return message.metadata?.portal ?? null;
  }

  private messageProviderPayload(message: WhatsAppMessage): WhatsAppWebhookPayload | null {
  return message.metadata?.payload ?? null;
  }

  private composerMenuItemValue(item: MenuItem): WhatsAppMessageComposerType | null {
    const value = item.value;
    return this.isComposerType(value) ? value : null;
  }

  private isComposerType(value: string | undefined): value is WhatsAppMessageComposerType {
    return composerTypeOptions.some(option => option.value === value);
  }

  private normalizeReplyContext(reply: WhatsAppPortalReply | undefined): MessageReplyContext | null {
  const body = reply?.body?.trim();
  if (!body) {
    return null;
  }
  return {
    body,
    ...(reply?.messageId?.trim() ? { messageId: reply.messageId.trim() } : {}),
  };
  }

  private normalizePortalContacts(portal: WhatsAppPortalMetadata | null): MessageContactCard[] {
  const contacts: MessageContactCard[] = [];
  const append = (contact: WhatsAppPortalContact | undefined) => {
    const normalized = this.normalizeContactCard(contact?.name, contact?.phone);
    if (normalized) {
    contacts.push(normalized);
    }
  };
  append(portal?.contact);
  for (const contact of portal?.contacts ?? []) {
    append(contact);
  }
  return contacts;
  }

  private normalizePortalLocation(location: WhatsAppPortalLocation | undefined): MessageLocationCard | null {
  if (!location) {
    return null;
  }
  const normalized: MessageLocationCard = {
    ...(location.latitude?.trim() ? { latitude: location.latitude.trim() } : {}),
    ...(location.longitude?.trim() ? { longitude: location.longitude.trim() } : {}),
    ...(location.name?.trim() ? { name: location.name.trim() } : {}),
    ...(location.address?.trim() ? { address: location.address.trim() } : {}),
    ...(location.live ? { live: true } : {}),
  };
  return normalized.latitude || normalized.longitude || normalized.name || normalized.address || normalized.live ? normalized : null;
  }

  private normalizePortalPoll(poll: WhatsAppPortalPoll | undefined): MessagePollCard | null {
  if (!poll) {
    return null;
  }
  const question = poll.question?.trim() || undefined;
  const options = this.normalizeStringList(poll.options);
  const selectedOptions = this.normalizeStringList(poll.selectedOptions);
  const maxAnswer = this.stringifyValue(poll.maxAnswer);
  if (!question && options.length === 0 && selectedOptions.length === 0 && !maxAnswer) {
    return null;
  }
  return {
    ...(question ? { question } : {}),
    options,
    selectedOptions,
    ...(maxAnswer ? { maxAnswer } : {}),
  };
  }

  private normalizeContactCard(name?: string, phone?: string): MessageContactCard | null {
  const trimmedName = name?.trim() || '';
  const trimmedPhone = phone?.trim() || '';
  if (!trimmedName && !trimmedPhone) {
    return null;
  }
  return {
    name: trimmedName || trimmedPhone,
    ...(trimmedPhone ? { phone: trimmedPhone } : {}),
  };
  }

  private normalizeProviderContact(name?: string, vcard?: string): MessageContactCard | null {
  const phone = this.extractPhoneFromVCard(vcard);
  return this.normalizeContactCard(name, phone);
  }

  private extractPhoneFromVCard(vcard?: string): string | undefined {
  if (!vcard) {
    return undefined;
  }
  for (const line of vcard.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.toUpperCase().startsWith('TEL')) {
    continue;
    }
    const value = trimmed.split(':', 2)[1]?.trim();
    if (value) {
    return value;
    }
  }
  return undefined;
  }

  private providerMediaKind(payload: WhatsAppWebhookPayload | null): MessageMediaContent['kind'] | null {
  if (!payload) {
    return null;
  }
  if (payload.image) {
    return 'image';
  }
  if (payload.video) {
    return 'video';
  }
  if (payload.audio) {
    return 'audio';
  }
  if (payload.document) {
    return 'file';
  }
  if (payload.sticker) {
    return 'sticker';
  }
  if (payload.video_note) {
    return 'video_note';
  }
  return null;
  }

  private providerMediaValue(payload: WhatsAppWebhookPayload, kind: MessageMediaContent['kind']): unknown {
  switch (kind) {
    case 'image':
    return payload.image;
    case 'video':
    return payload.video;
    case 'audio':
    return payload.audio;
    case 'file':
    return payload.document;
    case 'sticker':
    return payload.sticker;
    case 'video_note':
    return payload.video_note;
  }
  }

  private providerMediaUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (!this.isRecord(value)) {
    return null;
  }
  return this.stringifyValue(value['url'] ?? value['path']) || null;
  }

  private providerMediaCaption(value: unknown): string | null {
  if (!this.isRecord(value)) {
    return null;
  }
  return this.stringifyValue(value['caption']) || null;
  }

  private providerMediaFilename(value: unknown): string | null {
  if (!this.isRecord(value)) {
    return null;
  }
  return this.stringifyValue(value['filename']) || null;
  }

  private normalizeMediaUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/${trimmed}`;
  }

  private mediaLabel(kind: MessageMediaContent['kind']): string {
  switch (kind) {
    case 'image':
    return '[Afbeelding]';
    case 'video':
    return '[Video]';
    case 'audio':
    return '[Audio]';
    case 'file':
    return '[Bestand]';
    case 'sticker':
    return '[Sticker]';
    default:
    return '[Videonotitie]';
  }
  }

  private isMediaMessageType(value: string): value is MessageMediaContent['kind'] {
  return value === 'image' || value === 'video' || value === 'audio' || value === 'file' || value === 'sticker' || value === 'video_note';
  }

  private normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map(value => this.stringifyValue(value))
    .filter((value): value is string => !!value);
  }

  private recordString(value: unknown, key: string): string | undefined {
  if (!this.isRecord(value)) {
    return undefined;
  }
  return this.stringifyValue(value[key]) || undefined;
  }

  private stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
  }

  private isConversationLike(value: Partial<WhatsAppConversation>): value is WhatsAppConversation {
    return typeof value.id === 'string' && typeof value.phoneNumber === 'string' && typeof value.lastMessageAt === 'string';
  }

  private isMessageLike(value: Partial<WhatsAppMessage>): value is WhatsAppMessage {
    return typeof value.id === 'string' && typeof value.conversationId === 'string' && typeof value.createdAt === 'string';
  }

  private isDeleteMessageDisabled(message: WhatsAppMessage): boolean {
    return this.actionMessageTarget(message) === null || message.direction !== 'outbound' || this.isMessageRemoved(message) || this.hasMessageActionInFlight();
  }

  private isRevokeMessageDisabled(message: WhatsAppMessage): boolean {
    return this.actionMessageTarget(message) === null || message.direction !== 'outbound' || this.isMessageRemoved(message) || this.hasMessageActionInFlight();
  }

  private isEditMessageDisabled(message: WhatsAppMessage): boolean {
    return this.actionMessageTarget(message) === null || message.direction !== 'outbound' || this.isMessageRemoved(message) || this.editableMessageBody(message) === null || this.hasMessageActionInFlight();
  }

  protected isReactionDisabled(message: WhatsAppMessage): boolean {
    return this.actionMessageTarget(message) === null || this.isMessageRemoved(message) || this.hasMessageActionInFlight();
  }

  private isStarMessageDisabled(message: WhatsAppMessage): boolean {
    return this.actionMessageTarget(message) === null || this.hasMessageActionInFlight();
  }

  private isDownloadMessageDisabled(message: WhatsAppMessage): boolean {
    return this.actionMessageTarget(message) === null || this.messageMedia(message) === null || this.hasMessageActionInFlight();
  }

  private canAttachMessageToLead(message: WhatsAppMessage): boolean {
    return !!this.selectedConversation()?.leadId
      && message.direction === 'inbound'
      && this.actionMessageTarget(message) !== null
      && this.messageMedia(message)?.kind === 'image'
      && !this.hasMessageActionInFlight();
  }

  private hasMessageActionInFlight(): boolean {
    return this.reactingMessageId() !== null
      || this.editingMessageId() !== null
      || this.deletingMessageId() !== null
      || this.revokingMessageId() !== null
      || this.starringMessageId() !== null
      || this.downloadingMessageId() !== null
      || this.attachingMessageId() !== null;
  }

  protected isConversationActionBusy(): boolean {
    return this.togglingConversationAction() !== null;
  }

  private actionMessageTarget(message: WhatsAppMessage | null): string | null {
    const target = message?.externalMessageId?.trim();
    return target || null;
  }

  private currentReactionForMessage(message: WhatsAppMessage): string | null {
    const reactions = this.messagePortalMetadata(message)?.reactions ?? [];
    for (const reaction of reactions) {
      if (reaction.isFromMe && reaction.reaction?.trim()) {
        return reaction.reaction.trim();
      }
    }
    return null;
  }

  protected isMessageStarred(message: WhatsAppMessage): boolean {
    return !!message.metadata?.portal?.starred;
  }

  protected threadStateBadges(): { key: string; icon: string; label: string }[] {
    const conversation = this.selectedConversation();
    if (!conversation) {
      return [];
    }
    const state = this.threadState(conversation.id);
    const badges: { key: string; icon: string; label: string }[] = [];
    if (this.isConversationArchived(conversation)) {
      badges.push({ key: 'archived', icon: 'archive', label: 'Gearchiveerd' });
    }
    if (state.pinned) {
      badges.push({ key: 'pinned', icon: 'pin', label: 'Vastgezet' });
    }
    if ((state.timerSeconds ?? 0) > 0) {
      badges.push({ key: 'timer', icon: 'clock', label: this.disappearingTimerLabel(state.timerSeconds ?? 0) });
    }
    return badges;
  }

  protected disappearingTimerLabel(timerSeconds: number): string {
    const matched = this.disappearingTimerOptions.find(option => option.value === timerSeconds);
    if (matched) {
      return `Verdwijnt: ${matched.label}`;
    }
    return `Verdwijnt: ${timerSeconds}s`;
  }

  protected deleteConversationDialogDescription(): string {
    const conversationId = this.pendingDeleteConversationId();
    if (!conversationId) {
      return 'Deze chat wordt uit de inbox verwijderd.';
    }

    const conversation = this.conversations().find(item => item.id === conversationId) ?? this.selectedConversation();
    if (!conversation) {
      return 'Deze chat wordt uit de inbox verwijderd.';
    }

    return `Deze chat met ${this.displayName(conversation)} wordt uit de inbox verwijderd.`;
  }

  private editableMessageBody(message: WhatsAppMessage): string | null {
    if (this.messageMedia(message) || this.messageContacts(message).length > 0 || this.messageLocation(message) || this.messagePoll(message)) {
      return null;
    }

    const body = this.messagePrimaryBody(message)?.trim();
    return body || null;
  }

  private isConversationArchived(conversation: WhatsAppConversation): boolean {
    return !!conversation.archivedAt;
  }

  private isConversationDeleted(conversation: WhatsAppConversation): boolean {
    return !!conversation.deletedAt;
  }

  private isConversationVisibleInActiveList(conversation: WhatsAppConversation): boolean {
    return !this.isConversationArchived(conversation) && !this.isConversationDeleted(conversation);
  }

  private isConversationVisibleInCurrentFilter(conversation: WhatsAppConversation): boolean {
    if (this.isConversationDeleted(conversation)) {
      return false;
    }

    const filter = this.conversationListFilter();
    if (filter === 'archived') {
      return this.isConversationArchived(conversation);
    }
    if (this.isConversationArchived(conversation)) {
      return false;
    }
    if (filter === 'unread') {
      return conversation.unreadCount > 0;
    }
    return true;
  }

  private prefillCreateLeadFromConversation(): void {
    const conversation = this.selectedConversation();
    if (!conversation) {
      return;
    }
    const [firstName, lastName] = this.splitName(this.displayName(conversation));
    this.createLeadFirstName.set(firstName);
    this.createLeadLastName.set(lastName);
    this.createLeadEmail.set(this.conversationLinkedLead()?.email ?? this.conversationSuggestedLead()?.email ?? '');
    this.createLeadStreet.set('');
    this.createLeadHouseNumber.set('');
    this.createLeadZipCode.set('');
    this.createLeadCity.set(this.conversationSuggestedLead()?.city ?? '');
    const firstServiceType = this.availableServiceTypes()[0];
    if (!this.createLeadServiceType() && firstServiceType) {
	      this.createLeadServiceType.set(firstServiceType.name);
    }
  }

  private splitName(value: string): [string, string] {
    const trimmed = value.trim();
    if (!trimmed || trimmed === this.selectedConversation()?.phoneNumber) {
      return ['', ''];
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return [trimmed, ''];
    }
    return [parts[0] ?? '', parts.slice(1).join(' ')];
  }

  private resetConversationLeadPanels(): void {
    this.showLeadSearchPanel.set(false);
    this.showCreateLeadPanel.set(false);
    this.leadSearchQuery.set('');
    this.leadSearchResults.set([]);
    this.leadSearchLoading.set(false);
    this.leadRelationshipBusy.set(null);
  }

  private deleteMessagePreview(message: WhatsAppMessage): string {
    const media = this.messageMedia(message);
    const primaryBody = this.messagePrimaryBody(message)?.trim();
    if (primaryBody) {
      return this.truncateForDialog(primaryBody);
    }
    if (media?.filename) {
      return this.truncateForDialog(`${media.label} ${media.filename}`);
    }
    if (media) {
      return media.label;
    }
    const body = message.body.trim();
    return body ? this.truncateForDialog(body) : '';
  }

  private truncateForDialog(value: string, maxLength = 120): string {
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, maxLength - 1).trimEnd()}…`;
  }

  private resetComposerState(type: WhatsAppMessageComposerType = 'text'): void {
    this.composerType.set(type);
    this.composerBody.set('');
    this.aiSuggestionSeed.set(null);
    this.aiSuggestionConversationId.set(null);
    this.suggestionScenario.set('generic');
    this.suggestionScenarioNotes.set('');
    this.composerCaption.set('');
    this.clearComposerAttachment();
    this.composerViewOnce.set(false);
    this.composerCompress.set(false);
    this.composerPushToTalk.set(false);
    this.composerContactName.set('');
    this.composerContactPhone.set('');
    this.composerLatitude.set('');
    this.composerLongitude.set('');
    this.composerPollQuestion.set('');
    this.composerPollOptionOne.set('');
    this.composerPollOptionTwo.set('');
    this.composerPollOptionThree.set('');
    this.composerPollOptionFour.set('');
    this.composerPollMaxAnswer.set(1);
  }

  private isUploadType(type: WhatsAppMessageComposerType): boolean {
    return type === 'image' || type === 'video' || type === 'audio' || type === 'file' || type === 'sticker';
  }

  private getComposerValidationMessage(): string | null {
    const type = this.composerType();
    if (type === 'text') {
      return this.validateTextComposer();
    }
    if (this.isUploadType(type)) {
      return this.validateUploadComposer();
    }
    if (type === 'contact') {
      return this.validateContactComposer();
    }
    if (type === 'location') {
      return this.validateLocationComposer();
    }
    if (type === 'poll') {
      return this.validatePollComposer();
    }
    return null;
  }

  private validateTextComposer(): string | null {
    return this.composerBody().trim() === '' ? 'Voer een bericht in.' : null;
  }

  private validateUploadComposer(): string | null {
    return this.composerAttachmentBase64() ? null : 'Kies een bestand om te uploaden.';
  }

  private validateContactComposer(): string | null {
    if (this.composerContactName().trim() === '') {
      return 'Vul een contactnaam in.';
    }
    return this.composerContactPhone().trim() === '' ? 'Vul een contacttelefoon in.' : null;
  }

  private validateLocationComposer(): string | null {
    if (this.composerLatitude().trim() === '') {
      return 'Vul een latitude in.';
    }
    return this.composerLongitude().trim() === '' ? 'Vul een longitude in.' : null;
  }

  private validatePollComposer(): string | null {
    if (this.composerPollQuestion().trim() === '') {
      return 'Vul een poll-vraag in.';
    }
    const options = this.pollOptions();
    if (options.length < 2) {
      return 'Een poll heeft minimaal twee opties nodig.';
    }
    const maxAnswer = this.composerPollMaxAnswer();
    if (maxAnswer < 1 || maxAnswer > options.length) {
      return 'Kies een geldig maximaal aantal antwoorden.';
    }
    return null;
  }

  private buildComposerPayload(): SendWhatsAppConversationMessageRequest | null {
    const type = this.composerType();
    switch (type) {
      case 'text':
        return this.buildTextComposerPayload();
      case 'image':
      case 'video':
      case 'audio':
      case 'file':
      case 'sticker':
        return this.buildUploadComposerPayload(type);
      case 'contact':
        return {
          type,
          contactName: this.composerContactName().trim(),
          contactPhone: this.composerContactPhone().trim(),
        };
      case 'location':
        return {
          type,
          latitude: this.composerLatitude().trim(),
          longitude: this.composerLongitude().trim(),
        };
      case 'poll':
        return {
          type,
          question: this.composerPollQuestion().trim(),
          options: this.pollOptions(),
          maxAnswer: this.composerPollMaxAnswer(),
        };
      default:
        return null;
    }
  }

  private buildTextComposerPayload(): SendWhatsAppConversationMessageRequest {
    const payload: SendWhatsAppConversationMessageRequest = { body: this.composerBody().trim() };
    const conversationId = this.selectedConversationId();
    const aiSuggestion = this.aiSuggestionSeed();
    if (conversationId && aiSuggestion && this.aiSuggestionConversationId() === conversationId) {
      payload.aiSuggestion = aiSuggestion;
    }
    return payload;
  }

  private buildUploadComposerPayload(type: 'image' | 'video' | 'audio' | 'file' | 'sticker'): SendWhatsAppConversationMessageRequest {
    const payload: SendWhatsAppConversationMessageRequest = { type };
    const caption = this.composerCaption().trim();
    const attachment: NonNullable<SendWhatsAppConversationMessageRequest['attachment']> = {};
    const attachmentName = this.composerAttachmentName();
    const attachmentBase64 = this.composerAttachmentBase64();

    if (attachmentName) {
      attachment.filename = attachmentName;
    }
    if (attachmentBase64) {
      attachment.base64Data = attachmentBase64;
    }
    if (Object.keys(attachment).length > 0) {
      payload.attachment = attachment;
    }
    if ((type === 'image' || type === 'video' || type === 'file') && caption !== '') {
      payload.caption = caption;
    }
    if (type === 'image' || type === 'video') {
      payload.viewOnce = this.composerViewOnce();
      payload.compress = this.composerCompress();
    }
    if (type === 'audio') {
      payload.pushToTalk = this.composerPushToTalk();
    }

    return payload;
  }

  private pollOptions(): string[] {
    return [
      this.composerPollOptionOne(),
      this.composerPollOptionTwo(),
      this.composerPollOptionThree(),
      this.composerPollOptionFour(),
    ]
      .map(option => option.trim())
      .filter(option => option !== '');
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.readAsDataURL(file);
    });
  }

  private normalizeError(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const apiError = (error as { error?: { message?: string; error?: string } }).error;
      return apiError?.message || apiError?.error || 'WhatsApp inbox kon niet worden geladen.';
    }
    return 'WhatsApp inbox kon niet worden geladen.';
  }
}