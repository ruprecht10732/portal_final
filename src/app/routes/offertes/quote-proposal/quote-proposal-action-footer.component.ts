import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-quote-proposal-action-footer',
  imports: [LucideAngularModule],
  templateUrl: './quote-proposal-action-footer.component.html',
  styleUrl: './quote-proposal-action-footer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalActionFooterComponent {
  readonly variant = input<'mobile' | 'desktop'>('mobile');
  readonly isFinalized = input(false);
  readonly isReadOnly = input(false);
  readonly accepting = input(false);
  readonly rejecting = input(false);

  readonly accept = output<void>();
  readonly reject = output<void>();
}
