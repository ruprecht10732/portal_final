import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-quote-proposal-mobile-header',
  imports: [LucideAngularModule, TranslatePipe],
  templateUrl: './quote-proposal-mobile-header.component.html',
  styleUrl: './quote-proposal-mobile-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalMobileHeaderComponent {
  readonly quoteNumber = input<string>('');
  readonly share = output<void>();
}
