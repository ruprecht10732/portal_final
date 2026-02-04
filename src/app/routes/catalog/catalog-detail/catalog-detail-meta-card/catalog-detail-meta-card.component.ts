import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-catalog-detail-meta-card',
  imports: [DatePipe, TranslateModule],
  templateUrl: './catalog-detail-meta-card.component.html',
  styleUrl: './catalog-detail-meta-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailMetaCardComponent {
  readonly formattedPeriod = input<string | null>(null);
  readonly createdAt = input.required<string | Date>();
  readonly updatedAt = input.required<string | Date>();
}
