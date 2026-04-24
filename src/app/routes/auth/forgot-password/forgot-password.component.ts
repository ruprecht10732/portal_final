import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { createEmailError } from '../../../core/utils/auth-form.utils';
import { handleAuthSubmit } from '../../../core/utils/rx-operators';

@Component({
  selector: 'auth-forgot-password',
  imports: [RouterLink, TranslatePipe, ButtonComponent, InputComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  protected readonly email = signal('');
  protected readonly isSubmitting = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly emailError = createEmailError(this.email, this.translate);

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !this.emailError()
  );

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);

    this.authService.forgotPassword({ email: this.email() })
      .pipe(handleAuthSubmit(this.destroyRef, this.isSubmitting, this.toast))
      .subscribe(() => {
        void this.router.navigate(['/check-email'], { queryParams: { mode: 'reset' } });
      });
  }
}
