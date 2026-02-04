import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { MIN_LENGTH } from '../../../core/config';
import { handleSubmitState } from '../../../core/utils/rx-operators';

interface PasswordRule {
  label: string;
  met: boolean;
}

@Component({
  selector: 'auth-reset-password',
  imports: [RouterLink, ButtonComponent, InputComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly globalError = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly reporter = inject(ErrorReportingService);

  protected readonly token = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('token'))),
    { initialValue: null }
  );

  protected readonly isTokenValid = computed(() => !!this.token());

  protected readonly hasMinLength = computed(() => this.password().length >= MIN_LENGTH.password);
  protected readonly hasNumber = computed(() => /\d/.test(this.password()));
  protected readonly hasUppercase = computed(() => /[A-Z]/.test(this.password()));
  protected readonly hasSpecial = computed(() => /[^A-Za-z0-9]/.test(this.password()));

  protected readonly passwordRules = computed<PasswordRule[]>(() => [
    { label: `At least ${MIN_LENGTH.password} characters`, met: this.hasMinLength() },
    { label: 'Contains a number', met: this.hasNumber() },
    { label: 'Contains an uppercase letter', met: this.hasUppercase() },
    { label: 'Contains a special character', met: this.hasSpecial() },
  ]);

  protected readonly passwordError = computed(() => {
    const value = this.password();
    if (!value) return '';
    return this.hasMinLength() ? '' : `Password must be at least ${MIN_LENGTH.password} characters`;
  });

  protected readonly confirmError = computed(() => {
    if (!this.confirmPassword()) return '';
    return this.confirmPassword() === this.password() ? '' : 'Passwords do not match';
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

    this.globalError.set('');
    this.isSubmitting.set(true);

    this.authService.resetPassword({ token: tokenValue, newPassword: this.password() })
      .pipe(
        handleSubmitState({
          loading: this.isSubmitting,
          error: this.globalError,
          reporter: this.reporter,
          getMessage: (error) => this.authService.getErrorMessage(error),
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        void this.router.navigate(['/sign-in']);
      });
  }
}
