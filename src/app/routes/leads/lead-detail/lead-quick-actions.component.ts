import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-lead-quick-actions',
  templateUrl: './lead-quick-actions.component.html',
  styleUrl: './lead-quick-actions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class LeadQuickActionsComponent {
  phone = input<string | null>(null);
  email = input<string | null>(null);
  hasSelectedService = input(false);
  isProcessing = input(false);

  callClicked = output<void>();
  emailClicked = output<void>();
  logCallClicked = output<void>();
  navigateClicked = output<void>();
  quoteClicked = output<void>();

  protected handlePhoneClick(): void {
    const phoneNumber = this.phone();
    if (phoneNumber) {
      globalThis.location.href = `tel:${phoneNumber}`;
    }
  }

  protected handleEmailClick(): void {
    const email = this.email();
    if (email) {
      globalThis.location.href = `mailto:${email}`;
    }
    this.emailClicked.emit();
  }
}
