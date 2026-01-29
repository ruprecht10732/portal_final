import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'shared-contact-info',
  templateUrl: './contact-info.component.html',
  styleUrl: './contact-info.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
