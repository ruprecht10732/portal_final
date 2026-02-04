import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';

@Component({
  selector: 'organization-invite-form',
  imports: [ButtonComponent, InputComponent, RouterLink, TranslatePipe],
  templateUrl: './organization-invite-form.component.html',
  styleUrl: './organization-invite-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationInviteFormComponent {
  title = input('');
  subtitle = input('');
  listLinkLabel = input('');
  listLink = input('/app/organization/invites');

  errorMessage = input('');
  successMessage = input('');
  isLoading = input(false);

  email = input('');
  emailError = input('');
  inviteToken = input('');

  showSubmit = input(true);
  submitLabel = input('');
  submitDisabled = input(false);
  submitLoading = input(false);
  submitAriaLabel = input('');

  emailChange = output<string>();
  submitted = output<void>();

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.showSubmit()) {
      this.submitted.emit();
    }
  }
}
