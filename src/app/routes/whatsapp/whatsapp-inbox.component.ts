import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { EMPTY, catchError, finalize } from 'rxjs';
import { ToastService } from '../../core/services/toast.service';
import { SSEService, type SSEEvent } from '../../core/services/sse.service';
import { WhatsAppDeviceStatusService } from '../../core/services/whatsapp-device-status.service';
import { WhatsAppInboxService } from '../../core/services/whatsapp-inbox.service';
import { WhatsAppUnreadCountService } from '../../core/services/whatsapp-unread-count.service';
import type {
  SendWhatsAppConversationMessageRequest,
  WhatsAppConversation,
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
import { MenuComponent, type MenuItem, type MenuSection } from '../../shared/components/menu/menu.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

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

type ConversationListFilter = 'all' | 'unread';

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

@Component({
  selector: 'app-whatsapp-inbox',
  imports: [TranslateModule, LucideAngularModule, ButtonComponent, MenuComponent, PageLayoutComponent],
  templateUrl: './whatsapp-inbox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppInboxComponent {
  private readonly inbox = inject(WhatsAppInboxService);
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
  protected readonly aiSuggestionSeed = signal<string | null>(null);
  protected readonly aiSuggestionConversationId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isMobileViewport = signal(false);
  protected readonly composerTypes = composerTypeOptions;
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
  protected readonly canSend = computed(() => this.deviceStatus.canSend());
  protected readonly unreadConversationCount = computed(() => this.conversations().filter(item => item.unreadCount > 0).length);
  protected readonly hasConversationSearch = computed(() => this.conversationSearchQuery().trim() !== '');
  protected readonly filteredConversations = computed(() => {
    const filter = this.conversationListFilter();
    const query = this.conversationSearchQuery().trim().toLowerCase();

    return this.conversations().filter(conversation => {
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

  constructor() {
    if (globalThis.window !== undefined) {
      const mediaQuery = globalThis.window.matchMedia('(max-width: 1023px)');
      const syncViewport = () => this.isMobileViewport.set(mediaQuery.matches);
      syncViewport();
      mediaQuery.addEventListener('change', syncViewport);
      this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', syncViewport));
    }

    this.deviceStatus.startPolling();
    this.loadConversations();
    this.subscribeToRealtimeEvents();
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
        if (selectedConversationId && conversations.some(item => item.id === selectedConversationId)) {
          return;
        }

        const firstConversation = conversations[0];
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
    this.selectedConversationId.set(conversationId);
    this.loadMessages(conversationId);
  }

  protected closeConversation(): void {
    this.stopTypingPresence();
    this.selectedConversationId.set(null);
    this.messages.set([]);
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
    this.inbox.suggestReply(conversation.id)
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

  protected deviceStateLabel(): string {
    const status = this.deviceStatus.status();
    if (!status) {
      return 'Status wordt geladen';
    }

    const state = status.state.trim();
    if (state === '') {
      return status.message || 'Onbekend';
    }

    return status.message ? `${state} · ${status.message}` : state;
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
        if (conversation.unreadCount > 0) {
          this.markConversationRead(conversation.id);
        }
      });
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

  private resetComposerState(type: WhatsAppMessageComposerType = 'text'): void {
    this.composerType.set(type);
    this.composerBody.set('');
    this.aiSuggestionSeed.set(null);
    this.aiSuggestionConversationId.set(null);
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