import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { MapPreviewComponent } from '../../../../shared/components/map-preview/map-preview.component';
import { PartnerDetailEditRowComponent } from '../partner-detail-edit-row/partner-detail-edit-row.component';

interface DetailRow {
  key: string;
  labelKey: string;
  value: string;
}

@Component({
  selector: 'app-partner-detail-address-card',
  templateUrl: './partner-detail-address-card.component.html',
  styleUrl: './partner-detail-address-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    LucideAngularModule,
    ButtonComponent,
    MapPreviewComponent,
    PartnerDetailEditRowComponent,
  ],
})
export class PartnerDetailAddressCardComponent {
  readonly titleKey = input.required<string>();
  readonly rows = input.required<DetailRow[]>();
  readonly editingKey = input<string | null>(null);
  readonly editValue = input('');
  readonly mapAddress = input<string>('');
  readonly googleMapsUrl = input<string>('');

  readonly startEdit = output<string>();
  readonly cancelEdit = output<void>();
  readonly saveEdit = output<string>();
  readonly editValueChange = output<string>();
  readonly openGoogleMaps = output<void>();
}
