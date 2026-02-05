import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { ContactInfoComponent } from '../../../shared/components/contact-info/contact-info.component';

@Component({
  selector: 'app-lead-detail-mobile-consumer-card',
  templateUrl: './lead-detail-mobile-consumer-card.component.html',
  styleUrl: './lead-detail-mobile-consumer-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, ContactInfoComponent, TranslatePipe],
})
export class LeadDetailMobileConsumerCardComponent {
  fullName = input<string>('');
  fullAddress = input<string>('');
  mapUrl = input<string>('');
  copiedAddress = input<boolean>(false);
  phone = input<string>('');
  email = input<string | null>(null);
  role = input<string | null>(null);
  assignedTo = input<string | null>(null);
  hasSelectedService = input<boolean>(false);

  copyAddress = output<void>();
  openCallLogger = output<void>();
}
