import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { BottomSheetComponent } from '../../../shared/components/bottom-sheet/bottom-sheet.component';
import { LucideAngularModule } from 'lucide-angular';
import { QuoteProposalSignatureBlockComponent } from './quote-proposal-signature-block.component';

@Component({
  selector: 'app-quote-proposal-accept-sheet',
  imports: [BottomSheetComponent, LucideAngularModule, QuoteProposalSignatureBlockComponent, TranslatePipe],
  templateUrl: './quote-proposal-accept-sheet.component.html',
  styleUrl: './quote-proposal-accept-sheet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalAcceptSheetComponent {
  readonly isOpen = input(false);
  readonly signatureName = input('');
  readonly signatureData = input<string | null>(null);
  readonly accepting = input(false);

  readonly requestDismiss = output<void>();
  readonly requestConfirm = output<void>();
  readonly nameChange = output<string>();
  readonly signatureChange = output<string | null>();
}
