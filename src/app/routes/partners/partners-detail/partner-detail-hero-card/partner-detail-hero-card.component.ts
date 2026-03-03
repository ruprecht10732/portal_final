import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-partner-detail-hero-card',
  templateUrl: './partner-detail-hero-card.component.html',
  styleUrl: './partner-detail-hero-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class PartnerDetailHeroCardComponent {
  readonly businessName = input.required<string>();
  readonly contactEmail = input<string>('');
  readonly logoPreviewUrl = input<string | null>(null);
  readonly logoDownloadUrl = input<string | null>(null);
  readonly logoInitials = input<string>('P');
  readonly logoImageError = input(false);
  readonly logoError = input<string | null>(null);
  readonly createdAt = input<string>('');
  readonly updatedAt = input<string>('');

  readonly logoFailed = output<void>();
}
