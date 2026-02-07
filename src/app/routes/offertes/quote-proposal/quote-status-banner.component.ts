import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import type { QuoteStatus } from '../../../core/services/quotes.types';

@Component({
  selector: 'app-quote-status-banner',
  imports: [DatePipe],
  templateUrl: './quote-status-banner.component.html',
  styleUrl: './quote-status-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteStatusBannerComponent {
  readonly status = input<QuoteStatus | null>(null);
  readonly acceptedAt = input<string | null>(null);
  readonly downloading = input(false);
  readonly variant = input<'mobile' | 'desktop'>('mobile');

  readonly download = output<void>();
}
