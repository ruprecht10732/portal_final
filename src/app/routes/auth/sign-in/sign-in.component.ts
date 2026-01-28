import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, EMPTY } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'auth-sign-in',
  imports: [RouterLink, ButtonComponent, InputComponent],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInComponent {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly globalError = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Email format is invalid';
  });

  protected readonly passwordError = computed(() => {
    const value = this.password();
    if (!value) return '';
    return value.length >= 8 ? '' : 'Password must be at least 8 characters';
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !!this.password() && !this.emailError() && !this.passwordError()
  );

  constructor() {}

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.globalError.set('');
    this.isSubmitting.set(true);

    this.authService.signIn({ email: this.email(), password: this.password() })
      .pipe(
        catchError(error => {
          this.globalError.set(this.authService.getErrorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        void this.router.navigate(['/app']);
      });
  }
}
