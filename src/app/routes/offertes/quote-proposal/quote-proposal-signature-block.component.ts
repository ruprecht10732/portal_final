import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';

import { SignaturePadComponent } from '../../../shared/components/signature-pad/signature-pad.component';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-quote-proposal-signature-block',
  imports: [SignaturePadComponent, LucideAngularModule],
  templateUrl: './quote-proposal-signature-block.component.html',
  styleUrl: './quote-proposal-signature-block.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalSignatureBlockComponent {
  readonly name = input('');
  readonly signatureData = input<string | null>(null);

  readonly nameChange = output<string>();
  readonly signatureChange = output<string | null>();

  private readonly signaturePad = viewChild<SignaturePadComponent>(SignaturePadComponent);

  protected clearSignature(): void {
    const pad = this.signaturePad();
    if (pad) {
      pad.clear();
    }
    this.signatureChange.emit(null);
  }
}
