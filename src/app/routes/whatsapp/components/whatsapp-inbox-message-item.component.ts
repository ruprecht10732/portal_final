import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { MenuItem, MenuSection } from '../../../shared/components/menu/menu.component';
import { MenuComponent } from '../../../shared/components/menu/menu.component';
import type { WhatsAppMessage } from '../../../core/services/whatsapp-inbox.types';

export interface WhatsAppInboxMessageMutationBadge {
  key: string;
  icon: string;
  label: string;
  className: string;
}

export interface WhatsAppInboxMessageReplyContext {
  messageId?: string;
  body: string;
}

export interface WhatsAppInboxMessageMedia {
  kind: 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'video_note';
  label: string;
  url: string | null;
  caption: string | null;
  filename: string | null;
  actionLabel: string;
  resolving: boolean;
  loadError: string | null;
  canDownload: boolean;
}

export interface WhatsAppInboxMessageContact {
  name: string;
  phone?: string;
}

export interface WhatsAppInboxMessageLocation {
  latitude?: string;
  longitude?: string;
  name?: string;
  address?: string;
  live?: boolean;
  mapsUrl?: string | null;
}

export interface WhatsAppInboxMessagePoll {
  question?: string;
  options: string[];
  selectedOptions: string[];
  maxAnswer?: string;
}

export interface WhatsAppInboxMessageTranscription {
  label: string;
  detail?: string;
  text?: string;
  error?: string;
  badgeClass: string;
}

export interface WhatsAppInboxMessageReactionSummary {
  key: string;
  reaction: string;
  count: number;
  tooltip: string;
}

@Component({
  selector: 'app-whatsapp-inbox-message-item',
  imports: [LucideAngularModule, MenuComponent],
  templateUrl: './whatsapp-inbox-message-item.component.html', 
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppInboxMessageItemComponent {
  message = input.required<WhatsAppMessage>();
  importantSelectionEnabled = input(false);
  canToggleImportantSelection = input(false);
  selectedAsImportant = input(false);
  savingImportantMessages = input(false);
  shouldShowMessageActions = input(false);
  isMobileViewport = input(false);
  isReactionDisabled = input(false);
  quickReactionChoices = input<readonly string[]>([]);
  isReactingMessage = input(false);
  isEditingMessage = input(false);
  isDeletingMessage = input(false);
  isRevokingMessage = input(false);
  isStarringMessage = input(false);
  isDownloadingMessage = input(false);
  isAttachingMessage = input(false);
  messageMenuSections = input<readonly MenuSection[]>([]);
  mutationBadges = input<readonly WhatsAppInboxMessageMutationBadge[]>([]);
  replyContext = input<WhatsAppInboxMessageReplyContext | null>(null);
  media = input<WhatsAppInboxMessageMedia | null>(null);
  transcription = input<WhatsAppInboxMessageTranscription | null>(null);
  contacts = input<readonly WhatsAppInboxMessageContact[]>([]);
  location = input<WhatsAppInboxMessageLocation | null>(null);
  poll = input<WhatsAppInboxMessagePoll | null>(null);
  primaryBody = input<string | null>(null);
  originalBody = input<string | null>(null);
  reactionSummaries = input<readonly WhatsAppInboxMessageReactionSummary[]>([]);
  reactionChipClass = input('');
  messageBodyClass = input('');
  isStarred = input(false);
  relativeCreatedAt = input('');
  statusIcon = input('');
  statusLabel = input('');

  toggleImportantSelection = output<void>();
  quickReact = output<string>();
  messageMenuItemSelected = output<MenuItem>();
  messageMediaDownload = output<void>();
  messageMediaLoadError = output<void>();

  protected readonly isOutbound = computed(() => this.message().direction === 'outbound');
  protected readonly hasMessageActionInFlight = computed(() =>
    this.isReactingMessage()
    || this.isEditingMessage()
    || this.isDeletingMessage()
    || this.isRevokingMessage()
    || this.isStarringMessage()
    || this.isDownloadingMessage()
    || this.isAttachingMessage()
  );
}
