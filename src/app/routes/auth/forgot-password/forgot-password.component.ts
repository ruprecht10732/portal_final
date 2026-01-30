import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, EMPTY } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';

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
  protected readonly globalError = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly reporter = inject(ErrorReportingService);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Email format is invalid';
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !this.emailError()
  );

  constructor() {}

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.globalError.set('');
    this.isSubmitting.set(true);

    this.authService.forgotPassword({ email: this.email() })
      .pipe(
        catchError(error => {
          const message = this.authService.getErrorMessage(error);
          this.globalError.set(message);
          this.reporter.report(error, { source: 'http', silent: true, userMessage: message });
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
