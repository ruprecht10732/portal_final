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
  WhatsAppPresenceType,
} from '../../core/services/whatsapp-inbox.types';
import { ButtonComponent } from '../../shared/components/button/button.component';
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
  imports: [TranslateModule, LucideAngularModule, ButtonComponent, PageLayoutComponent],
  templateUrl: './whatsapp-inbox.component.html',
  styleUrl: './whatsapp-inbox.component.css',
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
  protected readonly sendingPresence = signal<WhatsAppPresenceType | null>(null);
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
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isMobileViewport = signal(false);
  protected readonly composerTypes = composerTypeOptions;

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
  protected readonly isUploadComposer = computed(() => this.isUploadType(this.composerType()));
  protected readonly showCaptionComposer = computed(() => {
    const type = this.composerType();
    return type === 'image' || type === 'video' || type === 'file';
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

  protected setComposerType(type: WhatsAppMessageComposerType): void {
    if (this.composerType() === type) {
      return;
    }

    this.stopTypingPresence();
    this.resetComposerState(type);
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
    if (!this.canSend()) {
      return 'Berichten verzenden is tijdelijk niet beschikbaar.';
    }
    if (this.composerIsEncodingAttachment()) {
      return 'Bestand wordt voorbereid voor verzending.';
    }
    return this.composerValidationMessage() ?? 'Verstuurt direct via het gekoppelde WhatsApp-apparaat.';
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

  private isConversationLike(value: Partial<WhatsAppConversation>): value is WhatsAppConversation {
    return typeof value.id === 'string' && typeof value.phoneNumber === 'string' && typeof value.lastMessageAt === 'string';
  }

  private isMessageLike(value: Partial<WhatsAppMessage>): value is WhatsAppMessage {
    return typeof value.id === 'string' && typeof value.conversationId === 'string' && typeof value.createdAt === 'string';
  }

  private resetComposerState(type: WhatsAppMessageComposerType = 'text'): void {
    this.composerType.set(type);
    this.composerBody.set('');
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
        return { body: this.composerBody().trim() };
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