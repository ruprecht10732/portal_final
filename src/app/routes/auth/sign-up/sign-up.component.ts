import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';

interface PasswordRule {
  label: string;
  met: boolean;
}

@Component({
  selector: 'auth-sign-up',
  imports: [RouterLink, ButtonComponent, InputComponent],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpComponent {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);

  private submitTimeoutId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Email format is invalid';
  });

  protected readonly hasMinLength = computed(() => this.password().length >= 8);
  protected readonly hasNumber = computed(() => /\d/.test(this.password()));
  protected readonly hasUppercase = computed(() => /[A-Z]/.test(this.password()));
  protected readonly hasSpecial = computed(() => /[^A-Za-z0-9]/.test(this.password()));

  protected readonly passwordRules = computed<PasswordRule[]>(() => [
    { label: 'At least 8 characters', met: this.hasMinLength() },
    { label: 'Contains a number', met: this.hasNumber() },
    { label: 'Contains an uppercase letter', met: this.hasUppercase() },
    { label: 'Contains a special character', met: this.hasSpecial() },
  ]);

  protected readonly passwordError = computed(() => {
    const value = this.password();
    if (!value) return '';
    return this.hasMinLength() ? '' : 'Password must be at least 8 characters';
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !!this.password() && !this.emailError() && this.hasMinLength()
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.submitTimeoutId !== null) {
        globalThis.clearTimeout(this.submitTimeoutId);
      }
    });

    effect(() => {
      const value = this.email();
      const trimmed = value.trim();
      if (trimmed !== value) {
        this.email.set(trimmed);
      }
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);
    if (this.submitTimeoutId !== null) {
      globalThis.clearTimeout(this.submitTimeoutId);
    }

    this.submitTimeoutId = globalThis.setTimeout(() => {
      this.isSubmitting.set(false);
      this.router.navigate(['/check-email'], { queryParams: { mode: 'signup' } });
    }, 1200);
  }
}
