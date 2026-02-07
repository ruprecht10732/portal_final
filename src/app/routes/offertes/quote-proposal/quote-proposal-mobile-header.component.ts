import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-quote-proposal-mobile-header',
  imports: [LucideAngularModule],
  templateUrl: './quote-proposal-mobile-header.component.html',
  styleUrl: './quote-proposal-mobile-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalMobileHeaderComponent {
  readonly quoteNumber = input<string>('');
  readonly share = output<void>();
}
