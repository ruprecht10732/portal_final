import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type WhatsAppInboxConversationListFilter = 'all' | 'unread' | 'archived';

export interface WhatsAppInboxConversationListItem {
  id: string;
  initial: string;
  unreadCount: number;
  displayName: string;
  phoneNumber: string;
  relativeTime: string;
  inbound: boolean;
  directionIcon: string;
  directionLabel: string;
  preview: string;
  selected: boolean;
}

@Component({
  selector: 'app-whatsapp-inbox-conversation-list',
  imports: [LucideAngularModule],
  templateUrl: './whatsapp-inbox-conversation-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppInboxConversationListComponent {
  filteredCount = input(0);
  totalCount = input(0);
  loadingConversations = input(false);
  conversationsCount = input(0);
  items = input<readonly WhatsAppInboxConversationListItem[]>([]);
  errorMessage = input<string | null>(null);
  canSend = input(false);
  sendingPresence = input(false);
  presenceSelected = input(false);
  presenceToggleAriaLabel = input('');
  presenceToggleTitle = input('');
  presenceToggleIcon = input('circle');
  activeFilter = input<WhatsAppInboxConversationListFilter>('all');
  unreadConversationCount = input(0);
  archivedConversationCount = input(0);
  conversationSearchQuery = input('');
  hasConversationSearch = input(false);

  openNewConversationDraft = output<void>();
  togglePresence = output<void>();
  refresh = output<void>();
  filterChange = output<WhatsAppInboxConversationListFilter>();
  conversationSearchQueryChange = output<string>();
  clearConversationSearch = output<void>();
  selectConversation = output<string>();
}
