import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { PartnerDetailEditRowComponent } from '../partner-detail-edit-row/partner-detail-edit-row.component';

interface DetailRow {
  key: string;
  labelKey: string;
  value: string;
  formatAsPhone?: boolean;
}

@Component({
  selector: 'app-partner-detail-contact-card',
  templateUrl: './partner-detail-contact-card.component.html',
  styleUrl: './partner-detail-contact-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent, PartnerDetailEditRowComponent],
})
export class PartnerDetailContactCardComponent {
  readonly titleKey = input.required<string>();
  readonly rows = input.required<DetailRow[]>();
  readonly editingKey = input<string | null>(null);
  readonly editValue = input('');
  readonly whatsappUrl = input<string>('');
  readonly phoneUrl = input<string>('');
  readonly emailUrl = input<string>('');

  readonly startEdit = output<string>();
  readonly cancelEdit = output<void>();
  readonly saveEdit = output<string>();
  readonly editValueChange = output<string>();

  readonly openWhatsApp = output<void>();
  readonly openCall = output<void>();
  readonly openEmail = output<void>();
}
