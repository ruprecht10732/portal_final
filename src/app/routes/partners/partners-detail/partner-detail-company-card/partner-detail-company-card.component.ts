import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PartnerDetailEditRowComponent } from '../partner-detail-edit-row/partner-detail-edit-row.component';

interface DetailRow {
  key: string;
  labelKey: string;
  value: string;
}

@Component({
  selector: 'app-partner-detail-company-card',
  templateUrl: './partner-detail-company-card.component.html',
  styleUrl: './partner-detail-company-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PartnerDetailEditRowComponent],
})
export class PartnerDetailCompanyCardComponent {
  readonly titleKey = input.required<string>();
  readonly rows = input.required<DetailRow[]>();
  readonly editingKey = input<string | null>(null);
  readonly editValue = input('');

  readonly startEdit = output<string>();
  readonly cancelEdit = output<void>();
  readonly saveEdit = output<string>();
  readonly editValueChange = output<string>();
}
