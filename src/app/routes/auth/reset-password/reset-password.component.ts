import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { MIN_LENGTH } from '../../../core/config';
import { getAuthErrorMessage } from '../../../core/utils/auth-error-mapper';
import {
  getConfirmPasswordError,
  getPasswordChecks,
  getPasswordMinLengthError,
  type PasswordRule,
} from '../../../core/utils/auth-form.utils';

@Component({
  selector: 'auth-reset-password',
  imports: [RouterLink, TranslatePipe, ButtonComponent, InputComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly isSubmitting = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly token = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('token'))),
    { initialValue: null }
  );

  protected readonly isTokenValid = computed(() => !!this.token());

  protected readonly passwordChecks = computed(() => getPasswordChecks(this.password(), MIN_LENGTH.password));

  protected readonly passwordRules = computed<PasswordRule[]>(() => {
    const checks = this.passwordChecks();
    const minLength = MIN_LENGTH.password;
    return [
      { label: this.translate.instant('auth.passwordRules.minLength', { minLength }), met: checks.hasMinLength },
      { label: this.translate.instant('auth.passwordRules.hasNumber'), met: checks.hasNumber },
      { label: this.translate.instant('auth.passwordRules.hasUppercase'), met: checks.hasUppercase },
      { label: this.translate.instant('auth.passwordRules.hasSpecial'), met: checks.hasSpecial },
    ];
  });

  protected readonly passwordError = computed(() => {
    const raw = getPasswordMinLengthError(this.password(), MIN_LENGTH.password);
    return raw ? this.translate.instant('auth.form.passwordError', { minLength: MIN_LENGTH.password }) : '';
  });

  protected readonly confirmError = computed(() => {
    const raw = getConfirmPasswordError(this.password(), this.confirmPassword());
    return raw ? this.translate.instant('auth.form.passwordMismatch') : '';
  });

  protected readonly canSubmit = computed(() =>
    this.isTokenValid() && !this.isSubmitting() && !!this.password() && !this.passwordError() && !this.confirmError()
  );

  // removed empty constructor to satisfy lint rule

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const tokenValue = this.token();
    if (!tokenValue) return;

    this.isSubmitting.set(true);

    this.authService.resetPassword({ token: tokenValue, newPassword: this.password() })
      .pipe(
        catchError(error => {
          this.toast.error(getAuthErrorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        void this.router.navigate(['/sign-in']);
      });
  }
}
