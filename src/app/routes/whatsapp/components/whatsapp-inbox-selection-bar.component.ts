import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';

@Component({
  selector: 'app-whatsapp-inbox-selection-bar',
  imports: [LucideAngularModule, SelectComponent],
  templateUrl: './whatsapp-inbox-selection-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppInboxSelectionBarComponent {
  selectedCount = input(0);
  showLinkedLeadServicePicker = input(false);
  linkedLeadServiceOptions = input<readonly SelectOption<string>[]>([]);
  linkedLeadServiceId = input<string | null>(null);
  linkedLeadLoading = input(false);
  savingImportantMessages = input(false);
  attachingMessage = input(false);

  linkedLeadServiceIdChange = output<string | null>();
  cancelSelection = output<void>();
  saveSelection = output<void>();

  protected readonly serviceSelectDisabled = computed(() =>
    this.linkedLeadLoading() || this.savingImportantMessages() || this.attachingMessage()
  );
}
