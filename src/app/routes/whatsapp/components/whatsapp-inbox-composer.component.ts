import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { MenuComponent, type MenuItem, type MenuSection } from '../../../shared/components/menu/menu.component';

@Component({
  selector: 'app-whatsapp-inbox-composer',
  imports: [LucideAngularModule, ButtonComponent, MenuComponent],
  templateUrl: './whatsapp-inbox-composer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block shrink-0' },
})
export class WhatsAppInboxComposerComponent {
  sendingMessage = input(false);
  canSend = input(false);
  isMobileViewport = input(false);
  canSuggestReply = input(false);
  composerBody = input('');
  composerTypeMenuSections = input<readonly MenuSection[]>([]);
  canSubmitComposer = input(false);
  sendButtonLabel = input('Verstuur');
  suggestingReply = input(false);
  hasActiveAISuggestion = input(false);
  willLearnEditedAISuggestion = input(false);
  aiLearningIndicatorText = input('');
  composerHelperText = input('');

  composerTypeMenuItemSelected = output<MenuItem>();
  composerBodyChange = output<string>();
  startTypingPresence = output<void>();
  stopTypingPresence = output<void>();
  openAIComposePanel = output<void>();
  sendMessage = output<void>();
}
