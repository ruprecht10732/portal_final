import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { ContactInfoComponent } from '../../../shared/components/contact-info/contact-info.component';
import { MapPreviewComponent } from '../../../shared/components/map-preview/map-preview.component';

@Component({
  selector: 'app-lead-detail-sidebar-info',
  templateUrl: './lead-detail-sidebar-info.component.html',
  styleUrl: './lead-detail-sidebar-info.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, ContactInfoComponent, MapPreviewComponent, TranslatePipe],
})
export class LeadDetailSidebarInfoComponent {
  fullAddress = input<string>('');
  mapUrl = input<string>('');
  latitude = input<number | null>(null);
  longitude = input<number | null>(null);
  fullName = input<string>('');
  phone = input<string>('');
  email = input<string | null>(null);
  role = input<string | null>(null);
  assignedTo = input<string | null>(null);
  hasSelectedService = input<boolean>(false);
  copiedAddress = input<boolean>(false);

  copyAddress = output<void>();
  openCallLogger = output<void>();
}
