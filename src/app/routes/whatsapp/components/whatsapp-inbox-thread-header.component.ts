import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MenuComponent, type MenuItem, type MenuSection } from '../../../shared/components/menu/menu.component';
import type { LeadInboxSummary } from '../../../core/services/whatsapp-inbox.types';

export interface WhatsAppInboxThreadStateBadge {
  key: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-whatsapp-inbox-thread-header',
  imports: [LucideAngularModule, MenuComponent],
  templateUrl: './whatsapp-inbox-thread-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block shrink-0' },
})
export class WhatsAppInboxThreadHeaderComponent {
  isDraftThreadOpen = input(false);
  isMobileViewport = input(false);
  selectedConversation = input(false);
  activeConversationInitial = input('');
  activeConversationDisplayName = input('');
  activeConversationPhoneNumber = input('');
  conversationLinkedLead = input<LeadInboxSummary | null>(null);
  conversationSuggestedLead = input<LeadInboxSummary | null>(null);
  threadStateBadges = input<readonly WhatsAppInboxThreadStateBadge[]>([]);
  isConversationActionBusy = input(false);
  threadMenuSections = input<readonly MenuSection[]>([]);
  draftPhoneNumber = input('');
  canUseLeadActions = input(false);
  importantSelectionEnabled = input(false);
  leadRelationshipBusy = input<'link' | 'unlink' | 'create' | null>(null);

  closeActiveThread = output<void>();
  openLeadContextPanel = output<void>();
  threadMenuItemSelected = output<MenuItem>();
  updateDraftPhoneNumber = output<string>();
  toggleLeadSearchPanel = output<void>();
  clearDraftLead = output<void>();
  unlinkConversationLead = output<void>();
  linkSuggestedLead = output<void>();
  openCreateLeadPanel = output<void>();
  toggleImportantSelectionMode = output<void>();
  openLeadDetail = output<string>();
}
