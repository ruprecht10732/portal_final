import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { BottomSheetComponent } from '../../../shared/components/bottom-sheet/bottom-sheet.component';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-quote-proposal-ask-sheet',
  imports: [BottomSheetComponent, LucideAngularModule, TranslatePipe],
  templateUrl: './quote-proposal-ask-sheet.component.html',
  styleUrl: './quote-proposal-ask-sheet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalAskSheetComponent {
  readonly isOpen = input(false);
  readonly itemDescription = input<string | null>(null);
  readonly organizationName = input('');
  readonly text = input('');
  readonly submitting = input(false);

  readonly requestDismiss = output<void>();
  readonly requestSend = output<void>();
  readonly textChange = output<string>();
}
