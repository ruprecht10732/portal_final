import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PhoneFormatPipe } from '../../pipes/phone-format.pipe';

@Component({
  selector: 'shared-contact-info',
  templateUrl: './contact-info.component.html',
  styleUrl: './contact-info.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhoneFormatPipe],
  host: {
    '[class]': "'block w-full'",
  },
})
export class ContactInfoComponent {
  phone = input<string | null>(null);
  email = input<string | null>(null);
  role = input<string | null>(null);
  assignedTo = input<string | null>(null);
}
