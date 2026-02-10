import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { getAuthErrorMessage } from '../../../core/utils/auth-error-mapper';
import { getEmailError } from '../../../core/utils/auth-form.utils';
import { catchError, finalize, EMPTY } from 'rxjs';

@Component({
  selector: 'auth-forgot-password',
  imports: [RouterLink, ButtonComponent, InputComponent],
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

  protected readonly emailError = computed(() => getEmailError(this.email()));

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !this.emailError()
  );

  // removed empty constructor to satisfy lint rule

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);

    this.authService.forgotPassword({ email: this.email() })
      .pipe(
        catchError(error => {
          this.toast.error(getAuthErrorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        void this.router.navigate(['/check-email'], { queryParams: { mode: 'reset' } });
      });
  }
}
