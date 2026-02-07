import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { BottomSheetComponent } from '../../../shared/components/bottom-sheet/bottom-sheet.component';

@Component({
  selector: 'app-quote-proposal-reject-sheet',
  imports: [BottomSheetComponent],
  templateUrl: './quote-proposal-reject-sheet.component.html',
  styleUrl: './quote-proposal-reject-sheet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalRejectSheetComponent {
  readonly isOpen = input(false);
  readonly reason = input('');
  readonly rejecting = input(false);

  readonly requestDismiss = output<void>();
  readonly requestConfirm = output<void>();
  readonly reasonChange = output<string>();
}
