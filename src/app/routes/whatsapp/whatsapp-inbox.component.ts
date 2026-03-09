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
import type { WhatsAppConversation, WhatsAppMessage } from '../../core/services/whatsapp-inbox.types';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

type WhatsAppConversationEventPayload = { conversation?: Partial<WhatsAppConversation> };
type WhatsAppMessageEventPayload = {
  conversation?: Partial<WhatsAppConversation>;
  message?: Partial<WhatsAppMessage>;
};

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
  protected readonly composerBody = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isMobileViewport = signal(false);

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
    const body = this.composerBody().trim();
    if (!conversation || body === '' || this.sendingMessage() || !this.canSend()) {
      return;
    }

    this.stopTypingPresence();
    this.sendingMessage.set(true);
    this.inbox.sendConversationMessage(conversation.id, { body })
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.sendingMessage.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ conversation: updatedConversation, message }) => {
        this.composerBody.set('');
        this.upsertConversation(updatedConversation);
        this.upsertMessage(message);
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

  private isConversationLike(value: Partial<WhatsAppConversation>): value is WhatsAppConversation {
    return typeof value.id === 'string' && typeof value.phoneNumber === 'string' && typeof value.lastMessageAt === 'string';
  }

  private isMessageLike(value: Partial<WhatsAppMessage>): value is WhatsAppMessage {
    return typeof value.id === 'string' && typeof value.conversationId === 'string' && typeof value.createdAt === 'string';
  }

  private normalizeError(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const apiError = (error as { error?: { message?: string; error?: string } }).error;
      return apiError?.message || apiError?.error || 'WhatsApp inbox kon niet worden geladen.';
    }
    return 'WhatsApp inbox kon niet worden geladen.';
  }
}