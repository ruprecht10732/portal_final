import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LeadLinkedWhatsAppConversation } from '../../../core/services/leads.types';

@Component({
  selector: 'app-lead-detail-chats-tab',
  templateUrl: './lead-detail-chats-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class LeadDetailChatsTabComponent {
  conversations = input<LeadLinkedWhatsAppConversation[]>([]);
  loading = input<boolean>(false);
  error = input<string | null>(null);
  formatHumanDateTime = input<(value: string | undefined | null) => string>((value) => value ?? '-');

  openConversation = output<LeadLinkedWhatsAppConversation>();

  protected readonly trackByConversationId = (_index: number, conversation: LeadLinkedWhatsAppConversation): string => conversation.conversationId;

  protected conversationName(conversation: LeadLinkedWhatsAppConversation): string {
    const displayName = conversation.displayName?.trim();
    return displayName && displayName.length > 0 ? displayName : conversation.phoneNumber;
  }

  protected conversationTimestamp(conversation: LeadLinkedWhatsAppConversation): string {
    return conversation.lastMessageAt ?? conversation.relationshipUpdatedAt;
  }
}