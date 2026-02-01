import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { OrganizationService } from '../../../core/services/organization.service';

@Component({
  selector: 'app-organization-invite-create',
  imports: [ButtonComponent, InputComponent, RouterLink, TranslatePipe],
  templateUrl: './organization-invite-create.component.html',
  styleUrl: './organization-invite-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationInviteCreateComponent {
  protected readonly email = signal('');
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly inviteToken = signal('');

  private readonly orgService = inject(OrganizationService);
  private readonly translate = inject(TranslateService);

  protected readonly emailError = computed(() => {
    const value = this.email().trim();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : this.translate.instant('organization.errors.emailInvalid');
  });

  protected readonly canSubmit = computed(() =>
    !this.isSaving() && !!this.email().trim() && !this.emailError()
  );

  protected save(): void {
    if (!this.canSubmit()) return;
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.inviteToken.set('');

    this.orgService
      .createInvite({ email: this.email().trim() })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return of(null);
        }),
        finalize(() => this.isSaving.set(false))
      )
      .subscribe(response => {
        if (!response) return;
        this.successMessage.set(this.translate.instant('organization.invite.sent'));
        this.inviteToken.set(response.token);
      });
  }

  private normalizeError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'error' in error) {
      const value = (error as { error?: string }).error;
      if (value) return value;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const value = (error as { message?: string }).message;
      if (value) return value;
    }
    return this.translate.instant('organization.errors.generic');
  }
}
